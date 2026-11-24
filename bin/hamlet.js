#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { homedir } from 'node:os'
import { join } from 'node:path'

async function main() {
    const [command = 'start'] = process.argv.slice(2)
    if (command === 'runner' || command === 'hub') {
        const executable = join(homedir(), '.local', 'bin', 'hamlet-' + command)
        const child = spawnSync(executable, process.argv.slice(3), { stdio: 'inherit' })
        if (child.error) throw child.error
        process.exitCode = child.status ?? 1
        return
    }
    const url = (process.env.HAMLET_API_URL || 'http://127.0.0.1:3006').replace(/\/$/, '')
    if (command === '--help' || command === 'help') {
        console.log('hamlet start | status | hub | runner\nOpen the main assistant or check HAMLET Hub health.')
        return
    }
    if (command === 'status') {
        const response = await fetch(url + '/health')
        if (!response.ok) throw new Error('HAMLET Hub unavailable')
        console.log(await response.text())
        return
    }
    if (!['start', 'ui'].includes(command)) throw new Error('Use hamlet start. Manage agents using the assistant’s Hamlet MCP tools.')
    let accessToken = process.env.CLI_API_TOKEN
    if (!accessToken) {
        const path = join(process.env.HAMLET_HOME || join(homedir(), '.hamlet'), 'settings.json')
        accessToken = JSON.parse(await readFile(path, 'utf8')).cliApiToken
    }
    if (!accessToken) throw new Error('Set CLI_API_TOKEN for your HAMLET Hub')
    const auth = await fetch(url + '/api/auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accessToken })
    })
    if (!auth.ok) throw new Error('HAMLET authentication failed')
    const { token } = await auth.json()
    const response = await fetch(url + '/api/hamlet/main', {
        method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: '{}'
    })
    if (!response.ok) throw new Error(await response.text())
    console.log(url + '/sessions/' + (await response.json()).agent_id)
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
