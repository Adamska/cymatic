import { DirectorResponseSchema, type DirectorResponse } from './directiveSchema'
import { matchDirective } from './semanticMatcher'

const ENDPOINT = '/api/direct'
const REQUEST_TIMEOUT_MS = 14000

export async function directScene(prompt: string, signal?: AbortSignal): Promise<DirectorResponse> {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt }),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    })
    if (response.ok) {
      const payload: unknown = await response.json()
      const parsed = DirectorResponseSchema.safeParse(payload)
      if (parsed.success) return parsed.data
    }
  } catch (error) {
    if (signal?.aborted) throw error
  }

  return { directive: matchDirective(prompt), source: 'preset' }
}
