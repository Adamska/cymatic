import { createGoogleGenerativeAI, type GoogleLanguageModelOptions } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { generateText, Output, type LanguageModel } from 'ai'
import { DirectorRequestSchema, SceneDirectiveSchema, type DirectorResponse } from '../src/ai/directiveSchema'
import { DIRECTOR_INSTRUCTIONS } from '../src/ai/directorInstructions'
import { matchDirective } from '../src/ai/semanticMatcher'

export const config = { runtime: 'edge' }

const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash'
const DEFAULT_OPENAI_MODEL = 'gpt-4.1-mini'
const MODEL_TIMEOUT_MS = 10000
const TITLE_LIMIT = 40
const NOTE_LIMIT = 160

function json(body: DirectorResponse | { error: string }, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}

interface Director {
  model: LanguageModel
  providerOptions?: { google: GoogleLanguageModelOptions }
}

/** Gemini when its key is set, otherwise OpenAI, otherwise none and the presets answer. */
function pickDirector(): Director | null {
  const geminiKey = process.env.GEMINI_API_KEY
  if (geminiKey) {
    const id = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL
    // Gemini 3 thinks at length by default; a light pass keeps a reply within a few seconds.
    const quick = /^gemini-[3-9]/.test(id)
    return {
      model: createGoogleGenerativeAI({ apiKey: geminiKey })(id),
      providerOptions: quick ? { google: { thinkingConfig: { thinkingLevel: 'low' } } } : undefined,
    }
  }
  const openaiKey = process.env.OPENAI_API_KEY
  if (openaiKey) return { model: createOpenAI({ apiKey: openaiKey })(process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL) }
  return null
}

async function directWithModel(prompt: string, { model, providerOptions }: Director): Promise<DirectorResponse> {
  const { output } = await generateText({
    model,
    providerOptions,
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
  const director = pickDirector()

  if (director) {
    try {
      return json(await directWithModel(prompt, director))
    } catch (error) {
      console.error('Scene director model call failed, serving a preset instead', error)
    }
  }

  return json({ directive: matchDirective(prompt), source: 'preset' })
}
