import type { IncomingMessage } from 'node:http'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

type EdgeHandler = (request: Request) => Promise<Response>

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    request.on('data', (chunk: Buffer) => chunks.push(chunk))
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    request.on('error', reject)
  })
}

const DEV_ROUTES = ['/api/direct', '/api/music'] as const

/** Serves the edge handlers in `api/` from the dev server, so local and deployed builds match. */
function edgeDevApi(): Plugin {
  return {
    name: 'cymatic-edge-dev-api',
    apply: 'serve',
    configureServer(server) {
      for (const route of DEV_ROUTES) {
        server.middlewares.use(route, (req, res) => {
          void (async () => {
            try {
              const module = (await server.ssrLoadModule(`${route}.ts`)) as { default: EdgeHandler }
              const method = req.method ?? 'GET'
              const response = await module.default(
                new Request(`http://localhost${req.originalUrl ?? route}`, {
                  method,
                  headers: { 'content-type': 'application/json' },
                  body: method === 'POST' ? await readBody(req) : undefined,
                }),
              )
              res.statusCode = response.status
              response.headers.forEach((value, key) => res.setHeader(key, value))
              res.end(await response.text())
            } catch (error) {
              server.config.logger.error(String(error))
              res.statusCode = 500
              res.end()
            }
          })()
        })
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'OPENAI_')
  Object.assign(process.env, env)

  return {
    plugins: [react(), tailwindcss(), edgeDevApi()],
    build: {
      target: 'es2022',
      chunkSizeWarningLimit: 1300,
    },
  }
})
