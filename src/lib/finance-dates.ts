// Datas do financeiro no fuso do negócio (F5A-044): o servidor da Vercel roda
// em UTC — agrupar com toISOString() jogava pedidos das 21h–24h de SP para o
// dia seguinte e o fim de período "T23:59:59" sem Z cortava às 20h59 local.
// BUSINESS_TZ default = fuso do Brasil (sem DST desde 2019).

const BUSINESS_TZ = process.env.BUSINESS_TZ || "America/Sao_Paulo"

// Offset (ms) do fuso em relação ao UTC na data dada (negativo para o Brasil).
function tzOffsetMs(date: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
  const parts = Object.fromEntries(dtf.formatToParts(date).map((p) => [p.type, p.value]))
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second)
  )
  return asUtc - Math.floor(date.getTime() / 1000) * 1000
}

// "YYYY-MM-DD" da data no fuso do negócio (chave de agrupamento diário).
export function dayKeyInTz(date: Date): string {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  return dtf.format(date)
}

function boundInTz(ymd: string, end: boolean): Date {
  // 00:00:00.000 (ou 23:59:59.999) de `ymd` no BUSINESS_TZ.
  const [y, m, d] = ymd.split("-").map(Number)
  const base = Date.UTC(y, m - 1, d, end ? 23 : 0, end ? 59 : 0, end ? 59 : 0, end ? 999 : 0)
  let guess = new Date(base)
  // Tal que wall(T) = alvo: T = alvo − offset(wall). O offset é recomputado
  // sobre o chute atual; duas iterações cobrem zonas com transição (DST).
  for (let i = 0; i < 2; i++) {
    guess = new Date(base - tzOffsetMs(guess))
  }
  return guess
}

// Início inclusivo (00:00 local do dia) de um filtro from="YYYY-MM-DD".
export function startOfInclusiveDay(ymd: string): Date {
  return boundInTz(ymd, false)
}

// Fim inclusivo (23:59:59.999 local do dia) de um filtro to="YYYY-MM-DD".
export function endOfInclusiveDay(ymd: string): Date {
  return boundInTz(ymd, true)
}

// { gte, lte } pronto para where.createdAt — só com os lados informados.
export function dayRangeFilter(from?: string | null, to?: string | null): { gte?: Date; lte?: Date } {
  const range: { gte?: Date; lte?: Date } = {}
  if (from) range.gte = startOfInclusiveDay(from)
  if (to) range.lte = endOfInclusiveDay(to)
  return range
}

// 00:00 local do dia corrente no fuso do negócio.
export function startOfTodayInTz(now: Date = new Date()): Date {
  return startOfInclusiveDay(dayKeyInTz(now))
}
