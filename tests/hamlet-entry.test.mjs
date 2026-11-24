import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { test } from 'node:test'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

test('owner opens the Hub session and a doorbell rings only its bound endpoint', async (t) => {
    const requests = []
    const server = createServer(async (req, res) => {
        let body = ''
        for await (const chunk of req) body += chunk
        requests.push([req.url, req.headers.authorization, JSON.parse(body)])
        const replies = {
            '/api/auth': { token: 'owner-jwt' },
            '/api/hamlet/main': { agent_id: 'main-id' },
            '/hamlet/ring': { event_id: 1 }
        }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(replies[req.url]))
    })
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    t.after(() => server.close())
    const url = 'http://127.0.0.1:' + server.address().port
    const run = (name, args, env) => promisify(execFile)(process.execPath, [
        fileURLToPath(new URL('../bin/' + name, import.meta.url)), ...args
    ], { env: { ...process.env, ...env } })
    const main = await run('hamlet.js', ['start'], { HAMLET_API_URL: url, CLI_API_TOKEN: 'owner-token' })
    assert.equal(main.stdout.trim(), url + '/sessions/main-id')
    await run('doorbell.js', ['ring', '--prompt', 'job finished', '--dedup-key', 'job-1'], {
        DOORBELL_URL: url + '/hamlet/ring', DOORBELL_TOKEN: 'bell-token'
    })
    assert.deepEqual(requests, [
        ['/api/auth', undefined, { accessToken: 'owner-token' }],
        ['/api/hamlet/main', 'Bearer owner-jwt', {}],
        ['/hamlet/ring', 'Bearer bell-token', { prompt: 'job finished', dedup_key: 'job-1' }]
    ])
})
