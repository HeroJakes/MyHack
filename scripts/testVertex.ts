import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { GoogleGenAI } from '@google/genai'

const envPath = resolve(process.cwd(), '.env')

if (existsSync(envPath)) {
  const envFile = readFileSync(envPath, 'utf8')
  for (const line of envFile.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const [key, ...valueParts] = trimmed.replace(/^export\s+/, '').split('=')
    if (!key || process.env[key]) continue
    process.env[key] = valueParts.join('=').replace(/^['"]|['"]$/g, '')
  }
}

for (const key of [
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'ALL_PROXY',
  'GIT_HTTP_PROXY',
  'GIT_HTTPS_PROXY',
  'http_proxy',
  'https_proxy',
  'all_proxy',
]) {
  delete process.env[key]
}

const project = process.env.GOOGLE_CLOUD_PROJECT
const location = process.env.GOOGLE_CLOUD_LOCATION ?? 'us-central1'

if (!project) {
  throw new Error('GOOGLE_CLOUD_PROJECT is required in .env or your shell.')
}

const client = new GoogleGenAI({
  vertexai: true,
  project,
  location,
})

const response = await client.models.generateContent({
  model: 'publishers/google/models/gemini-2.5-flash',
  contents: 'Reply with exactly: OK',
})

console.log(response.text?.trim())
