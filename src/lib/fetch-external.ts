// F3A-044/F4A-010: fetch para chamadas EXTERNAS com timeout — provedor mudo
// (iFood/99/Meta/Evolution/gateways) não segura a função serverless até o kill
// da Vercel. Usar só em chamadas fora do próprio app; fetch interno não precisa.
const EXTERNAL_TIMEOUT_MS = 15000

export async function fetchExternal(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const signal = init?.signal ?? AbortSignal.timeout(EXTERNAL_TIMEOUT_MS)
  return fetch(input, init ? { ...init, signal } : { signal })
}
