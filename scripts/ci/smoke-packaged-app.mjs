import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'

class CdpClient {
  #id = 0
  #pending = new Map()
  #socket
  #openPromise

  constructor(url) {
    this.#socket = new WebSocket(url)
    this.#openPromise = new Promise((resolve, reject) => {
      this.#socket.addEventListener('open', () => resolve())
      this.#socket.addEventListener('error', (event) => {
        reject(event.error ?? new Error(`Failed to open CDP socket ${url}`))
      })
    })
    this.#socket.addEventListener('message', (event) => {
      const payload = JSON.parse(String(event.data))
      if (typeof payload.id !== 'number') {
        return
      }
      const pending = this.#pending.get(payload.id)
      if (!pending) {
        return
      }
      this.#pending.delete(payload.id)
      if (payload.error) {
        pending.reject(new Error(payload.error.message ?? JSON.stringify(payload.error)))
        return
      }
      pending.resolve(payload.result ?? {})
    })
    this.#socket.addEventListener('close', () => {
      for (const pending of this.#pending.values()) {
        pending.reject(new Error('CDP socket closed'))
      }
      this.#pending.clear()
    })
  }

  async ready() {
    await this.#openPromise
  }

  async send(method, params = {}) {
    await this.ready()
    const id = ++this.#id
    const message = JSON.stringify({ id, method, params })
    return await new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject })
      this.#socket.send(message)
    })
  }

  close() {
    this.#socket.close()
  }
}

function parseArgs(argv) {
  const parsed = {
    executable: null,
    launchArgs: [],
    remoteDebuggingPort: 9222,
    timeoutMs: 60000,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--executable') {
      parsed.executable = argv[index + 1] ?? null
      index += 1
      continue
    }
    if (argument.startsWith('--launch-arg=')) {
      parsed.launchArgs.push(argument.slice('--launch-arg='.length))
      continue
    }
    if (argument === '--launch-arg') {
      parsed.launchArgs.push(argv[index + 1] ?? '')
      index += 1
      continue
    }
    if (argument.startsWith('--remote-debugging-port=')) {
      parsed.remoteDebuggingPort = Number(argument.slice('--remote-debugging-port='.length))
      continue
    }
    if (argument === '--remote-debugging-port') {
      parsed.remoteDebuggingPort = Number(argv[index + 1] ?? parsed.remoteDebuggingPort)
      index += 1
      continue
    }
    if (argument.startsWith('--timeout-ms=')) {
      parsed.timeoutMs = Number(argument.slice('--timeout-ms='.length))
      continue
    }
    if (argument === '--timeout-ms') {
      parsed.timeoutMs = Number(argv[index + 1] ?? parsed.timeoutMs)
      index += 1
    }
  }

  if (!parsed.executable) {
    throw new Error('Missing required --executable argument')
  }
  if (!Number.isFinite(parsed.remoteDebuggingPort) || parsed.remoteDebuggingPort <= 0) {
    throw new Error('remote debugging port must be a positive number')
  }
  if (!Number.isFinite(parsed.timeoutMs) || parsed.timeoutMs <= 0) {
    throw new Error('timeout must be a positive number')
  }

  return parsed
}

function normalizeFilePath(filePath) {
  if (typeof filePath !== 'string') {
    return null
  }

  const normalized = path.normalize(filePath)
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized
}

async function waitFor(description, fn, timeoutMs, intervalMs = 500) {
  const deadline = Date.now() + timeoutMs
  let lastError = null

  while (Date.now() < deadline) {
    try {
      const result = await fn()
      if (result) {
        return result
      }
    } catch (error) {
      if (error && typeof error === 'object' && 'fatal' in error && error.fatal === true) {
        throw error
      }
      lastError = error
    }
    await delay(intervalMs)
  }

  const suffix = lastError instanceof Error ? `: ${lastError.message}` : ''
  throw new Error(`Timed out waiting for ${description}${suffix}`)
}

function createFatalError(message, cause) {
  const error = new Error(message, cause ? { cause } : undefined)
  error.fatal = true
  return error
}

async function fetchJson(port, endpoint) {
  const response = await fetch(`http://127.0.0.1:${port}${endpoint}`)
  if (!response.ok) {
    throw new Error(`GET ${endpoint} failed with ${response.status}`)
  }
  return await response.json()
}

async function evaluate(client, expression) {
  const response = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  })
  if (response.exceptionDetails) {
    const description = response.exceptionDetails.text ?? 'Runtime.evaluate failed'
    throw new Error(description)
  }
  return response.result?.value
}

async function closeChild(child, graceMs = 15000) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return
  }

  const exited = await Promise.race([
    new Promise((resolve) => child.once('exit', () => resolve(true))),
    delay(graceMs).then(() => false),
  ])

  if (exited) {
    return
  }

  child.kill('SIGTERM')
  const terminated = await Promise.race([
    new Promise((resolve) => child.once('exit', () => resolve(true))),
    delay(5000).then(() => false),
  ])

  if (!terminated) {
    child.kill('SIGKILL')
    await new Promise((resolve) => child.once('exit', resolve))
  }
}

const { executable, launchArgs, remoteDebuggingPort, timeoutMs } = parseArgs(process.argv.slice(2))
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markflow-smoke-'))
const sampleFile = path.join(tempDir, 'smoke.md')
const sampleMarker = `MARKFLOW_SMOKE_${Date.now()}`

fs.writeFileSync(
  sampleFile,
  `# MarkFlow smoke\n\n${sampleMarker}\n\n- packaged launch\n- source toggle\n- preview toggle\n`,
  'utf8',
)

let browserClient = null
let pageClient = null
let launchError = null
const child = spawn(
  executable,
  [`--remote-debugging-port=${remoteDebuggingPort}`, '--disable-gpu', ...launchArgs, sampleFile],
  {
    stdio: 'inherit',
    env: process.env,
  },
)

child.once('error', (error) => {
  launchError = error
})

function assertChildRunning() {
  if (launchError) {
    throw createFatalError(`Failed to launch packaged app at ${executable}`, launchError)
  }
  if (child.exitCode !== null || child.signalCode !== null) {
    throw createFatalError(
      `Packaged app exited before smoke test completed (code=${child.exitCode}, signal=${child.signalCode})`,
    )
  }
}

try {
  const versionInfo = await waitFor(
    'Electron remote debugging endpoint',
    async () => {
      assertChildRunning()
      try {
        return await fetchJson(remoteDebuggingPort, '/json/version')
      } catch {
        return null
      }
    },
    timeoutMs,
  )

  browserClient = new CdpClient(versionInfo.webSocketDebuggerUrl)
  await browserClient.ready()

  const target = await waitFor(
    'MarkFlow page target',
    async () => {
      assertChildRunning()
      const targets = await fetchJson(remoteDebuggingPort, '/json/list')
      return (
        targets.find((candidate) => candidate.type === 'page' && typeof candidate.webSocketDebuggerUrl === 'string') ??
        null
      )
    },
    timeoutMs,
  )

  pageClient = new CdpClient(target.webSocketDebuggerUrl)
  await pageClient.ready()
  await pageClient.send('Runtime.enable')

  await waitFor(
    'renderer document readiness',
    async () => (await evaluate(pageClient, 'document.readyState === "complete"')) === true,
    timeoutMs,
  )

  const expectedPath = normalizeFilePath(sampleFile)
  await waitFor(
    'sample markdown file to load into the packaged editor',
    async () => {
      const documentState = await evaluate(
        pageClient,
        '(async () => window.markflow?.getCurrentDocument ? await window.markflow.getCurrentDocument() : null)()',
      )
      assertChildRunning()
      if (!documentState) {
        return null
      }
      const currentPath = normalizeFilePath(documentState.filePath)
      if (currentPath !== expectedPath) {
        return null
      }
      if (typeof documentState.content !== 'string' || !documentState.content.includes(sampleMarker)) {
        return null
      }
      return documentState
    },
    timeoutMs,
  )

  await waitFor(
    'Preview mode button to be active on initial render',
    async () =>
      (await evaluate(
        pageClient,
        'document.querySelector(\'button[aria-label="Preview mode"]\')?.getAttribute("aria-pressed") === "true"',
      )) === true,
    timeoutMs,
  )

  await evaluate(
    pageClient,
    `(() => {
      const button = document.querySelector('button[aria-label="Source mode"]')
      if (!(button instanceof HTMLButtonElement)) {
        throw new Error('Source mode button not found')
      }
      button.click()
      return true
    })()`,
  )

  await waitFor(
    'Source mode button to become active',
    async () =>
      (await evaluate(
        pageClient,
        'document.querySelector(\'button[aria-label="Source mode"]\')?.getAttribute("aria-pressed") === "true"',
      )) === true,
    timeoutMs,
  )

  await evaluate(
    pageClient,
    `(() => {
      const button = document.querySelector('button[aria-label="Preview mode"]')
      if (!(button instanceof HTMLButtonElement)) {
        throw new Error('Preview mode button not found')
      }
      button.click()
      return true
    })()`,
  )

  await waitFor(
    'Preview mode button to become active again',
    async () =>
      (await evaluate(
        pageClient,
        'document.querySelector(\'button[aria-label="Preview mode"]\')?.getAttribute("aria-pressed") === "true"',
      )) === true,
    timeoutMs,
  )

  await waitFor(
    'sample marker to stay visible after mode toggles',
    async () =>
      (await evaluate(pageClient, `document.body.textContent?.includes(${JSON.stringify(sampleMarker)}) === true`)) ===
      true,
    timeoutMs,
  )

  try {
    await browserClient.send('Browser.close')
  } catch {
    // Browser.close can drop the transport before responding; the process wait below is the real source of truth.
  }

  await closeChild(child)
  console.log(`Packaged smoke test passed for ${path.basename(executable)}`)
} finally {
  pageClient?.close()
  browserClient?.close()
  await closeChild(child).catch(() => {})
  fs.rmSync(tempDir, { recursive: true, force: true })
}
