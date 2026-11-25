#!/usr/bin/env node
import { parseArgs } from 'node:util'

async function ring() {
    const args = process.argv.slice(2)
    const { values } = parseArgs({
        args: args[0] === 'ring' ? args.slice(1) : args,
        options: { prompt: { type: 'string' }, 'dedup-key': { type: 'string' } }
    })
    if (!process.env.DOORBELL_URL || !process.env.DOORBELL_TOKEN) throw new Error('Run this command inside a Hamlet doorbell')
    if (!values.prompt) throw new Error('Usage: doorbell ring --prompt TEXT [--dedup-key KEY]')
    const response = await fetch(process.env.DOORBELL_URL, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + process.env.DOORBELL_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: values.prompt, dedup_key: values['dedup-key'] })
    })
    const result = await response.text()
    if (!response.ok) throw new Error(result)
    console.log(result)
}

ring().catch(error => { console.error(error.message); process.exitCode = 1 })
