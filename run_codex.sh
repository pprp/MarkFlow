#!/usr/bin/env bash

set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

LEDGER_FILE="$ROOT_DIR/harness/feature-ledger.json"
PROGRESS_FILE="$ROOT_DIR/harness/progress.md"

INTERVAL_SECONDS=120
FAIL_RETRY_SECONDS=120
MAX_ROUNDS=0
MAX_NO_PROGRESS=50
ONCE=0
DRY_RUN=0
ALLOW_DIRTY=0
CODEX_BIN="${CODEX_BIN:-codex}"
CODEX_MODEL="${CODEX_MODEL:-}"
CODEX_PROFILE="${CODEX_PROFILE:-}"
PROMPT_FILE="${PROMPT_FILE:-}"
LOG_DIR="${LOG_DIR:-$ROOT_DIR/.codex-loop}"
LOCK_DIR="${LOCK_DIR:-$LOG_DIR/lock}"
NO_PROGRESS_STREAK=0
# 默认绕过沙箱，方便 Codex 跑本地验证、监听 localhost、写入 .git/
# 如需启用沙箱保护，可设置 CODEX_USE_SANDBOX=1
CODEX_USE_SANDBOX="${CODEX_USE_SANDBOX:-0}"

if [[ -t 1 ]]; then
  COLOR_RESET=$'\033[0m'
  COLOR_INFO=$'\033[1;34m'
  COLOR_WARN=$'\033[1;33m'
  COLOR_ERROR=$'\033[1;31m'
  COLOR_OK=$'\033[1;32m'
else
  COLOR_RESET=''
  COLOR_INFO=''
  COLOR_WARN=''
  COLOR_ERROR=''
  COLOR_OK=''
fi

usage() {
  cat <<'USAGE'
Usage: ./run_codex.sh [options]

让 Codex 按 MarkFlow 的 harness 协议一轮一轮处理 feature ledger 中下一个可自动实现的任务。
默认只挑选 `status=planned`、`passes=false`、且依赖已满足的 feature，避免卡在仅差人工验证的 `ready` 项。

Options:
  --interval <seconds>         成功完成一轮后的等待时间，默认 120
  --fail-retry <seconds>       失败或无进展时的等待时间，默认 120
  --max-rounds <count>         最多运行多少轮，0 表示不限，默认 0
  --max-no-progress <count>    连续多少轮没有消化 planned feature 就停止，默认 50
  --model <name>               传给 `codex exec` 的模型名
  --prompt-file <path>         使用自定义 prompt 文件
  --once                       只执行一轮
  --dry-run                    只打印状态和即将发送给 Codex 的 prompt，不真正调用 Codex
  --allow-dirty                允许在 git 有未提交改动时启动
  -h, --help                   显示帮助

Environment:
  CODEX_BIN         Codex 可执行文件，默认 `codex`
  CODEX_PROFILE     可选，传给 `codex exec --profile`
  CODEX_EXTRA_ARGS  可选，按 shell 分词后附加到 `codex exec`
  CODEX_USE_SANDBOX 设为 1 则启用 Codex 沙箱（默认 0=绕过沙箱）
  LOG_DIR           日志目录，默认 `./.codex-loop`
USAGE
}

log_line() {
  local color="$1"
  local level="$2"
  shift 2
  printf '%s[%s] [%s]%s %s\n' "$color" "$(date '+%Y-%m-%d %H:%M:%S')" "$level" "$COLOR_RESET" "$*"
}

info() { log_line "$COLOR_INFO" INFO "$@"; }
warn() { log_line "$COLOR_WARN" WARN "$@"; }
error() { log_line "$COLOR_ERROR" ERROR "$@"; }
ok() { log_line "$COLOR_OK" OK "$@"; }

format_seconds() {
  local total="$1"
  local hours=$((total / 3600))
  local minutes=$(((total % 3600) / 60))
  local seconds=$((total % 60))

  if (( hours > 0 )); then
    printf '%dh%02dm%02ds' "$hours" "$minutes" "$seconds"
  elif (( minutes > 0 )); then
    printf '%dm%02ds' "$minutes" "$seconds"
  else
    printf '%ds' "$seconds"
  fi
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    error "缺少命令: $1"
    exit 1
  fi
}

git_index_lock_path() {
  local p
  p="$(git rev-parse --git-path index.lock)"
  if [[ "$p" = /* ]]; then
    printf '%s\n' "$p"
  else
    printf '%s/%s\n' "$ROOT_DIR" "$p"
  fi
}

git_index_lock_in_use() {
  local lock_path="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof "$lock_path" >/dev/null 2>&1
    return $?
  fi
  return 1
}

clear_stale_git_index_lock() {
  local lock_path
  lock_path="$(git_index_lock_path)"
  if [[ ! -e "$lock_path" ]]; then
    return 0
  fi

  if git_index_lock_in_use "$lock_path"; then
    error "检测到活跃 git 索引锁: $lock_path（请等待当前 git 进程结束后重试）"
    return 1
  fi

  warn "检测到残留 git 索引锁，自动清理: $lock_path"
  rm -f "$lock_path"
}

cleanup() {
  rm -rf "$LOCK_DIR"
}

on_interrupt() {
  warn "收到中断信号，结束自动循环。"
  exit 130
}

trap cleanup EXIT
trap on_interrupt INT TERM

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --interval)
        INTERVAL_SECONDS="$2"
        shift 2
        ;;
      --fail-retry)
        FAIL_RETRY_SECONDS="$2"
        shift 2
        ;;
      --max-rounds)
        MAX_ROUNDS="$2"
        shift 2
        ;;
      --max-no-progress)
        MAX_NO_PROGRESS="$2"
        shift 2
        ;;
      --model)
        CODEX_MODEL="$2"
        shift 2
        ;;
      --prompt-file)
        PROMPT_FILE="$2"
        shift 2
        ;;
      --once)
        ONCE=1
        shift
        ;;
      --dry-run)
        DRY_RUN=1
        shift
        ;;
      --allow-dirty)
        ALLOW_DIRTY=1
        shift
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        error "未知参数: $1"
        usage
        exit 1
        ;;
    esac
  done
}

ledger_stats() {
  python3 - <<'PY'
import json
from pathlib import Path

ledger = json.loads(Path('harness/feature-ledger.json').read_text())
features = ledger['features']
features_by_id = {feature['id']: feature for feature in features}
ordered = sorted(features, key=lambda feature: (feature['priority'], feature['id']))

verified = sum(1 for feature in features if feature['passes'])
remaining = sum(1 for feature in features if not feature['passes'])
ready = sum(1 for feature in features if feature['status'] == 'ready')
planned = sum(1 for feature in features if feature['status'] == 'planned')
blocked = sum(1 for feature in features if feature['status'] == 'blocked')

first_unresolved = next((feature for feature in ordered if not feature['passes']), None)
next_automatable = next(
    (
        feature
        for feature in ordered
        if not feature['passes']
        and feature['status'] == 'planned'
        and all(features_by_id[dependency]['passes'] for dependency in feature.get('dependsOn', []))
    ),
    None,
)

print(len(features))
print(verified)
print(remaining)
print(ready)
print(planned)
print(blocked)
print(next_automatable['id'] if next_automatable else '')
print(next_automatable['title'] if next_automatable else '')
print(next_automatable['priority'] if next_automatable else '')
print(next_automatable['area'] if next_automatable else '')
print(first_unresolved['id'] if first_unresolved else '')
print(first_unresolved['title'] if first_unresolved else '')
print(first_unresolved['status'] if first_unresolved else '')
PY
}

load_ledger_stats() {
  local -a stats
  local index=0
  local line

  while IFS= read -r line; do
    stats[$index]="$line"
    index=$((index + 1))
  done < <(ledger_stats)

  STATS_TOTAL="${stats[0]}"
  STATS_VERIFIED="${stats[1]}"
  STATS_REMAINING="${stats[2]}"
  STATS_READY="${stats[3]}"
  STATS_PLANNED="${stats[4]}"
  STATS_BLOCKED="${stats[5]}"
  STATS_NEXT_ID="${stats[6]}"
  STATS_NEXT_TITLE="${stats[7]}"
  STATS_NEXT_PRIORITY="${stats[8]}"
  STATS_NEXT_AREA="${stats[9]}"
  STATS_FIRST_ID="${stats[10]}"
  STATS_FIRST_TITLE="${stats[11]}"
  STATS_FIRST_STATUS="${stats[12]}"
}

get_actionable_ids() {
  python3 - <<'PY'
import json
from pathlib import Path

ledger = json.loads(Path('harness/feature-ledger.json').read_text())
features = ledger['features']
features_by_id = {feature['id']: feature for feature in features}
ordered = sorted(features, key=lambda feature: (feature['priority'], feature['id']))

for feature in ordered:
    if feature['passes'] or feature['status'] != 'planned':
        continue
    if all(features_by_id[dependency]['passes'] for dependency in feature.get('dependsOn', [])):
        print(feature['id'])
PY
}

format_feature_for_prompt() {
  local feature_id="$1"
  python3 - "$feature_id" <<'PY'
import json
import sys
from pathlib import Path

feature_id = sys.argv[1]
ledger = json.loads(Path('harness/feature-ledger.json').read_text())
feature = next((item for item in ledger['features'] if item['id'] == feature_id), None)

if feature is None:
    raise SystemExit(f'Unknown feature id: {feature_id}')

automated = feature.get('verification', {}).get('automated', [])
manual = feature.get('verification', {}).get('manual', [])
depends = feature.get('dependsOn', [])

lines = [
    f"- Feature ID: `{feature['id']}`",
    f"- 标题：{feature['title']}",
    f"- 状态：{feature['status']}",
    f"- 优先级：P{feature['priority']}",
    f"- Area：{feature['area']}",
    f"- 依赖：{', '.join(depends) if depends else 'none'}",
    f"- Notes：{feature['notes']}",
    "- Steps:",
]

for index, step in enumerate(feature.get('steps', []), start=1):
    lines.append(f"  {index}. {step}")

if automated:
    lines.append("- Automated verification:")
    for command in automated:
        lines.append(f"  - `{command}`")

if manual:
    lines.append("- Manual verification:")
    for step in manual:
        lines.append(f"  - {step}")

print('\n'.join(lines))
PY
}

git_dirty_count() {
  git status --porcelain | wc -l | tr -d ' '
}

ensure_lock() {
  mkdir -p "$LOG_DIR"
  if ! mkdir "$LOCK_DIR" 2>/dev/null; then
    local pid='unknown'
    if [[ -f "$LOCK_DIR/pid" ]]; then
      pid="$(cat "$LOCK_DIR/pid")"
    fi
    error "已有 run_codex.sh 实例在运行（lock: ${LOCK_DIR}, pid: ${pid}）"
    exit 1
  fi
  printf '%s\n' "$$" > "$LOCK_DIR/pid"
}

ensure_clean_start() {
  clear_stale_git_index_lock

  local dirty_count
  dirty_count="$(git_dirty_count)"
  if [[ "$ALLOW_DIRTY" -eq 0 && "$dirty_count" -gt 0 ]]; then
    error "当前 git 工作区不干净（$dirty_count 处改动）。为避免叠加会话，默认停止。"
    git status --short
    error "如确认要继续，可加 --allow-dirty。"
    exit 1
  fi

  if [[ "$dirty_count" -gt 0 ]]; then
    warn "当前 git 工作区已有 $dirty_count 处未提交改动。"
  fi
}

show_status_snapshot() {
  local dirty branch head

  load_ledger_stats
  dirty="$(git_dirty_count)"
  branch="$(git branch --show-current 2>/dev/null || echo detached)"
  head="$(git log -1 --pretty='%h %s' 2>/dev/null || echo 'no commits')"

  info "仓库: $ROOT_DIR"
  info "分支: $branch"
  info "HEAD: $head"
  info "Ledger: verified=$STATS_VERIFIED/$STATS_TOTAL | remaining=$STATS_REMAINING | ready=$STATS_READY | planned=$STATS_PLANNED | blocked=$STATS_BLOCKED"
  info "git dirty: $dirty"

  if [[ -n "$STATS_FIRST_ID" ]]; then
    info "首个未通过项: $STATS_FIRST_ID [$STATS_FIRST_STATUS] - $STATS_FIRST_TITLE"
  fi

  if [[ -n "$STATS_NEXT_ID" ]]; then
    info "下一个可自动处理 feature: $STATS_NEXT_ID [P${STATS_NEXT_PRIORITY}] [$STATS_NEXT_AREA] - $STATS_NEXT_TITLE"
  else
    warn "当前没有可自动处理的 planned feature；剩余项可能只差人工验证或被依赖阻塞。"
  fi
}

build_prompt() {
  local task_id="$1"

  if [[ -n "$PROMPT_FILE" ]]; then
    cat "$PROMPT_FILE"
    return
  fi

  cat <<EOF_PROMPT
阅读仓库根目录的 AGENTS.md，并严格执行其中的会话启动协议、单 feature 节奏、验证要求、Lore Commit Protocol 与会话结束协议。
先运行 \`pnpm harness:start\`，再运行 \`./harness/init.sh --smoke\`。
除非实现该 feature 必须做极小的前置修复，本轮只处理下面这个 feature：

$(format_feature_for_prompt "$task_id")

要求：
1. 只完成这一个 feature，不要顺手做第二个不相关 feature。
2. 实现后必须运行该 feature 的 automated verification，以及 \`pnpm harness:verify\`。必要时补充相关 lint/build/test。
3. 只有在验证结果真实满足要求时，才能更新 \`harness/feature-ledger.json\` 里的 \`status\`、\`passes\`、\`lastVerifiedAt\`。
4. 如果当前环境无法完成 manual verification，请保持 ledger 真实，不要把 \`passes\` 设为 true。
5. 会话结束前必须更新 \`harness/progress.md\`，写清改动、验证结果、剩余风险与下一个推荐 feature。
6. 会话结束前必须自己创建 git commit，且 commit message 必须符合 AGENTS.md 里的 Lore Commit Protocol。
7. 如果被阻塞，请把阻塞原因、失败验证和下一步建议写回仓库文件后再提交，不要空手结束。
EOF_PROMPT
}

run_codex_round() {
  local round="$1"
  local next_id="$2"
  local stamp start_epoch elapsed log_file last_msg_file prompt_file before_head after_head exit_code=0
  start_epoch="$(date +%s)"
  stamp="$(date '+%Y%m%d-%H%M%S')"
  log_file="$LOG_DIR/round-${round}-${stamp}.log"
  last_msg_file="$LOG_DIR/round-${round}-${stamp}.last.log"
  prompt_file="$LOG_DIR/round-${round}-${stamp}.prompt.log"
  before_head="$(git rev-parse --short HEAD 2>/dev/null || true)"

  build_prompt "$next_id" > "$prompt_file"

  local -a codex_args
  codex_args=(exec --cd "$ROOT_DIR" --color never -o "$last_msg_file")

  if [[ "${CODEX_USE_SANDBOX:-0}" != "1" ]]; then
    codex_args+=(--dangerously-bypass-approvals-and-sandbox)
  fi

  if [[ -n "$CODEX_MODEL" ]]; then
    codex_args+=(--model "$CODEX_MODEL")
  fi
  if [[ -n "$CODEX_PROFILE" ]]; then
    codex_args+=(--profile "$CODEX_PROFILE")
  fi
  if [[ -n "${CODEX_EXTRA_ARGS:-}" ]]; then
    # shellcheck disable=SC2206
    local extra_args=( ${CODEX_EXTRA_ARGS} )
    codex_args+=("${extra_args[@]}")
  fi

  info "第 $round 轮开始。日志: $log_file"
  info "本轮目标: $next_id"

  if [[ "$DRY_RUN" -eq 1 ]]; then
    warn "dry-run 模式：跳过 codex exec。"
    sed -n '1,240p' "$prompt_file"
    return 0
  fi

  if "$CODEX_BIN" "${codex_args[@]}" - < "$prompt_file" 2>&1 | tee "$log_file"; then
    exit_code=0
  else
    exit_code=$?
  fi

  elapsed=$(( $(date +%s) - start_epoch ))
  after_head="$(git rev-parse --short HEAD 2>/dev/null || true)"

  if [[ "$exit_code" -eq 0 ]]; then
    ok "第 $round 轮结束，耗时 $(format_seconds "$elapsed")。"
  else
    warn "第 ${round} 轮退出码 ${exit_code}，耗时 $(format_seconds "$elapsed")。"
  fi

  if [[ -f "$last_msg_file" && -s "$last_msg_file" ]]; then
    info "最后消息摘要："
    tail -n 12 "$last_msg_file" | sed 's/^/  │ /'
  fi

  if [[ -n "$before_head" && -n "$after_head" && "$before_head" != "$after_head" ]]; then
    ok "检测到新提交: $(git log -1 --pretty='%h %s')"
  else
    warn "本轮未检测到新的 git commit。"
  fi

  return "$exit_code"
}

compare_progress() {
  local before_file="$1"
  local after_file="$2"
  local cleared

  cleared="$(comm -23 <(sort "$before_file") <(sort "$after_file") | awk 'BEGIN{first=1} {if (!first) printf ", "; printf "%s", $0; first=0}')"
  if [[ -n "$cleared" ]]; then
    ok "本轮消化的 planned feature: $cleared"
  else
    warn "本轮未减少可自动处理的 planned feature。"
  fi
}

parse_args "$@"
require_cmd git
require_cmd python3
require_cmd "$CODEX_BIN"

if [[ ! -f "$LEDGER_FILE" ]]; then
  error "缺少 ledger 文件: $LEDGER_FILE"
  exit 1
fi

if [[ ! -f "$PROGRESS_FILE" ]]; then
  error "缺少 progress 文件: $PROGRESS_FILE"
  exit 1
fi

ensure_lock
ensure_clean_start

info "启动 MarkFlow 自动任务循环。"
info "配置: interval=$(format_seconds "$INTERVAL_SECONDS"), fail_retry=$(format_seconds "$FAIL_RETRY_SECONDS"), max_rounds=$MAX_ROUNDS, max_no_progress=$MAX_NO_PROGRESS"
show_status_snapshot

round=0
while true; do
  round=$((round + 1))

  load_ledger_stats
  total="$STATS_TOTAL"
  verified="$STATS_VERIFIED"
  remaining="$STATS_REMAINING"
  next_task_id="$STATS_NEXT_ID"
  next_task_title="$STATS_NEXT_TITLE"

  if [[ "$remaining" -eq 0 ]]; then
    ok "所有 feature 已完成：${verified}/${total}。"
    break
  fi

  if [[ -z "$next_task_id" ]]; then
    warn "所有可自动处理的 planned feature 已经消化完毕；剩余项需要人工验证或先解除阻塞。"
    break
  fi

  before_ids_file="$LOG_DIR/actionable-before-${round}.txt"
  after_ids_file="$LOG_DIR/actionable-after-${round}.txt"
  get_actionable_ids > "$before_ids_file"
  actionable_before="$(wc -l < "$before_ids_file" | tr -d ' ')"

  if ! run_codex_round "$round" "$next_task_id" "$next_task_title"; then
    warn "Codex 本轮未成功完成，$FAIL_RETRY_SECONDS 秒后重试。"
  fi

  get_actionable_ids > "$after_ids_file"
  actionable_after="$(wc -l < "$after_ids_file" | tr -d ' ')"
  compare_progress "$before_ids_file" "$after_ids_file"
  show_status_snapshot

  if [[ "$actionable_after" -lt "$actionable_before" ]]; then
    NO_PROGRESS_STREAK=0
  else
    NO_PROGRESS_STREAK=$((NO_PROGRESS_STREAK + 1))
  fi

  if [[ "$ONCE" -eq 1 ]]; then
    info "--once 已启用，执行一轮后退出。"
    break
  fi

  if [[ "$MAX_ROUNDS" -gt 0 && "$round" -ge "$MAX_ROUNDS" ]]; then
    warn "达到 max_rounds=${MAX_ROUNDS}，停止循环。"
    break
  fi

  if [[ "$NO_PROGRESS_STREAK" -ge "$MAX_NO_PROGRESS" ]]; then
    error "连续 $NO_PROGRESS_STREAK 轮没有减少 planned feature，停止循环，请人工检查日志。"
    exit 1
  fi

  if [[ "$actionable_after" -lt "$actionable_before" ]]; then
    info "$INTERVAL_SECONDS 秒后开始下一轮。"
    sleep "$INTERVAL_SECONDS"
  else
    warn "$FAIL_RETRY_SECONDS 秒后再试一轮。"
    sleep "$FAIL_RETRY_SECONDS"
  fi
done
