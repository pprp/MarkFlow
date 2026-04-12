import { historyField, undoDepth } from '@codemirror/commands'
import { type Extension, EditorState } from '@codemirror/state'

export const MAX_UNDO_HISTORY_EVENTS = 500

type SerializedHistoryEvent = {
  changes?: unknown
}

type SerializedHistoryState = {
  done: SerializedHistoryEvent[]
  undone: SerializedHistoryEvent[]
}

function pruneDoneBranch(
  done: SerializedHistoryEvent[],
  maxUndoEvents: number,
): SerializedHistoryEvent[] {
  let changeEventsKept = 0
  let startIndex = done.length

  for (let index = done.length - 1; index >= 0; index -= 1) {
    if (done[index].changes) {
      changeEventsKept += 1
      if (changeEventsKept > maxUndoEvents) {
        break
      }
    }
    startIndex = index
  }

  return done.slice(startIndex)
}

export function pruneHistoryState(
  state: EditorState,
  extensions: Extension,
  maxUndoEvents: number = MAX_UNDO_HISTORY_EVENTS,
): EditorState {
  if (undoDepth(state) <= maxUndoEvents) {
    return state
  }

  const json = state.toJSON({ history: historyField }) as {
    doc: string
    selection: unknown
    history: SerializedHistoryState
  }

  const prunedJson = {
    ...json,
    history: {
      done: pruneDoneBranch(json.history.done, maxUndoEvents),
      undone: [],
    },
  }

  return EditorState.fromJSON(prunedJson, { extensions }, { history: historyField })
}
