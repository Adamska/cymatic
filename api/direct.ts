import { createOpenAI } from '@ai-sdk/openai'
import { generateText, Output } from 'ai'
import { DirectorRequestSchema, SceneDirectiveSchema, type DirectorResponse } from '../src/ai/directiveSchema'
import { DIRECTOR_INSTRUCTIONS } from '../src/ai/directorInstructions'
import { matchDirective } from '../src/ai/semanticMatcher'

export const config = { runtime: 'edge' }

const DEFAULT_MODEL = 'gpt-4.1-mini'
const MODEL_TIMEOUT_MS = 10000
const TITLE_LIMIT = 40
const NOTE_LIMIT = 160

function json(body: DirectorResponse | { error: string }, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}

async function directWithModel(prompt: string, apiKey: string): Promise<DirectorResponse> {
  const openai = createOpenAI({ apiKey })
  const { output } = await generateText({
    model: openai(process.env.OPENAI_MODEL || DEFAULT_MODEL),
    instructions: DIRECTOR_INSTRUCTIONS,
    prompt,
    output: Output.object({ schema: SceneDirectiveSchema }),
    maxRetries: 1,
    abortSignal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
  })
  const directive = SceneDirectiveSchema.parse(output)
  return {
    directive: { ...directive, title: directive.title.slice(0, TITLE_LIMIT), note: directive.note.slice(0, NOTE_LIMIT) },
    source: 'model',
  }
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const payload: unknown = await request.json().catch(() => null)
  const parsed = DirectorRequestSchema.safeParse(payload)
  if (!parsed.success) return json({ error: 'A prompt between 1 and 240 characters is required' }, 400)

  const { prompt } = parsed.data
  const apiKey = process.env.OPENAI_API_KEY

  if (apiKey) {
    try {
      return json(await directWithModel(prompt, apiKey))
    } catch (error) {
      console.error('Scene director model call failed, serving a preset instead', error)
    }
  }

  return json({ directive: matchDirective(prompt), source: 'preset' })
}
