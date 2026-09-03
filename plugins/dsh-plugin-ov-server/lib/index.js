/**
 * dsh-plugin-ov-server — Host half
 *
 * Ensures the local OpenViking server (openviking-server, the context-database
 * backend for the @openviking/dsh-memory-plugin bundle) is running whenever DSH
 * starts. Spawns it detached (like dsh-plugin-local-llm-switch does for
 * llama-server) when nothing answers on the endpoint yet; leaves an already
 * running instance alone. Also registers /dsh-openviking/status|start|stop
 * routes on the host webServer for manual control from the browser.
 */

import { spawn, execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const name = 'ov-server'

export const inject = ['webServer']

const DEFAULTS = {
  endpoint: 'http://127.0.0.1:1933',
  exe: path.join(os.homedir(), '.local', 'bin', 'openviking-server.exe'),
  // Host/port match the server defaults; ov.conf at ~/.openviking/ov.conf
  // carries storage + embedding settings.
  args: ['--host', '127.0.0.1', '--port', '1933'],
  logFile: path.join(os.homedir(), '.openviking', 'server.log'),
  startTimeoutMs: 120000
}

function json(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(payload))
}

export function apply(ctx, config = {}) {
  const opts = { ...DEFAULTS, ...config }

  // Always make sure the server is up — even when webServer is absent (CLI).
  let child = null
  let starting = false
  let startedAt = null
  let disposed = false

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  async function healthOk() {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 3000)
      const response = await fetch(`${opts.endpoint}/health`, { signal: controller.signal })
      clearTimeout(timer)
      return response.ok
    } catch {
      return false
    }
  }

  function killPortOwner() {
    const port = new URL(opts.endpoint).port || 1933
    return new Promise((resolve) => {
      try {
        execFile('netstat', ['-ano'], { windowsHide: true }, (error, stdout) => {
          if (error) { resolve(); return }
          const re = new RegExp(`:${port}\\s`, 'g')
          for (const line of stdout.split(/\r?\n/)) {
            if (!/LISTENING/i.test(line)) continue
            if (!re.test(line)) continue
            const parts = line.trim().split(/\s+/)
            const pid = Number(parts[parts.length - 1])
            if (Number.isInteger(pid) && pid > 0) {
              try {
                process.kill(pid)
                ctx.logger?.info?.(`[ov-server] stopped process on :${port} (PID ${pid})`)
              } catch {}
            }
          }
          resolve()
        })
      } catch {
        resolve()
      }
    })
  }

  async function statusPayload() {
    const running = await healthOk()
    return {
      ok: true,
      running,
      starting,
      pid: running ? (child?.pid ?? null) : null,
      startedAt,
      endpoint: opts.endpoint
    }
  }

  async function startServer() {
    if (await healthOk()) return { ok: true, running: true, message: 'already-running' }
    if (starting) return { ok: true, running: false, starting: true, message: 'already-starting' }
    if (disposed) return { ok: false, error: 'disposed' }
    starting = true
    try {
      ctx.logger?.info?.('[ov-server] starting openviking-server...')
      // Append server stdout/stderr to a log file under ~/.openviking.
      let logFd = null
      try {
        fs.mkdirSync(path.dirname(opts.logFile), { recursive: true })
        logFd = fs.openSync(opts.logFile, 'a')
      } catch (error) {
        ctx.logger?.warn?.('[ov-server] cannot open log file: ' + error.message)
      }
      const spawned = spawn(opts.exe, opts.args, {
        detached: true,
        stdio: logFd === null ? 'ignore' : ['ignore', logFd, logFd],
        windowsHide: true
      })
      child = spawned
      spawned.unref()
      spawned.on('error', (error) => {
        ctx.logger?.warn?.('[ov-server] spawn failed: ' + error.message)
        if (child === spawned) child = null
      })
      spawned.on('exit', () => {
        if (child === spawned) child = null
      })

      const deadline = Date.now() + opts.startTimeoutMs
      while (Date.now() < deadline) {
        await sleep(2000)
        if (disposed) { starting = false; return { ok: false, error: 'disposed' } }
        if (await healthOk()) {
          startedAt = Date.now()
          starting = false
          return { ok: true, running: true, pid: spawned.pid, message: 'started' }
        }
      }
      starting = false
      return { ok: false, error: 'start-timeout: openviking-server did not become healthy' }
    } catch (error) {
      starting = false
      return { ok: false, error: String((error && error.message) || error) }
    }
  }

  async function stopServer() {
    if (child !== null && !child.killed) {
      ctx.logger?.info?.('[ov-server] stopping openviking-server...')
      child.kill()
    }
    child = null
    startedAt = null
    await killPortOwner()
    const running = await healthOk()
    return { ok: true, running, message: running ? 'still-running' : 'stopped' }
  }

  // Ensure the server is running as DSH boots; do not block apply().
  startServer().then((result) => {
    if (result && !result.ok) {
      ctx.logger?.warn?.('[ov-server] auto-start failed: ' + (result.error || 'unknown'))
    }
  })

  ctx.effect(() => {
    const webServer = ctx.get('webServer')
    if (webServer === undefined) return
    const unregister = [
      webServer.register({
        kind: 'exact',
        path: '/dsh-openviking/status',
        handler: async (req, res) => json(res, 200, await statusPayload())
      }),
      webServer.register({
        kind: 'exact',
        path: '/dsh-openviking/start',
        handler: async (req, res) => json(res, 200, await startServer())
      }),
      webServer.register({
        kind: 'exact',
        path: '/dsh-openviking/stop',
        handler: async (req, res) => json(res, 200, await stopServer())
      })
    ]
    return () => {
      for (const fn of unregister) {
        try { if (typeof fn === 'function') fn() } catch {}
      }
    }
  })

  ctx.on('dispose', () => {
    disposed = true
    // Detached children survive DSH by design (like llama-server), so on
    // dispose we only release references; /stop (or the OS) ends the server.
    child = null
  })
}
