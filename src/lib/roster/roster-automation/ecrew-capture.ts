import fs from 'node:fs'
import path from 'node:path'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import type { Page } from 'playwright'
import { buildEscalaXRosterPdf } from './escala-x-roster-pdf.ts'
import type {
  CaptureRosterResult,
  EcrewRosterDayOffRow,
  EcrewRosterFlightRow,
  EcrewRosterJson,
} from './ecrew-roster-types.ts'

export type {
  CaptureRosterResult,
  EcrewRosterDayOffRow,
  EcrewRosterFlightRow,
  EcrewRosterJson,
} from './ecrew-roster-types.ts'

const WAIT_ROSTER_MS = 180_000
const IFLIGHT_MAIN_PAGE = 'https://iflightla.ibsplc.aero/iflight-crew/web/getMainPage'

type RawBlock = {
  rawText: string
  className: string
  date: string | null
}

async function waitForManualSamlLoginIfNeeded(page: Page): Promise<void> {
  await page.goto(IFLIGHT_MAIN_PAGE, {
    waitUntil: 'domcontentloaded',
    timeout: WAIT_ROSTER_MS,
  })

  const currentUrl = page.url().toLowerCase()
  const requiresManualLogin =
    currentUrl.includes('saml-logoutpage') || currentUrl.includes('logout-redirect')

  if (!requiresManualLogin) return

  console.log('⏳ Faça login manualmente e pressione Enter...')
  const rl = createInterface({ input, output })
  try {
    await rl.question('')
  } finally {
    rl.close()
  }
}

export async function captureRoster(page: Page): Promise<CaptureRosterResult> {
  await waitForManualSamlLoginIfNeeded(page)

  console.log('📍 Abrindo menu Roster...')

  await page.getByText('Roster', { exact: true }).hover()
  await page.waitForTimeout(1000)

  console.log('📍 Clicando em Roster Calendar...')
  await page.getByText('Roster Calendar', { exact: true }).click()

  console.log('⏳ Aguardando tela da escala...')
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(3000)

  try {
    await page.waitForSelector(
      [
        '.roster-calendar',
        '.calendar',
        '.roster-cell',
        '[class*="roster"]',
        '[class*="calendar"]',
        '[class*="flight"]',
      ].join(', '),
      { timeout: WAIT_ROSTER_MS },
    )
  } catch (error) {
    const dir = path.join(process.cwd(), '.playwright')
    fs.mkdirSync(dir, { recursive: true })

    const screenshotPath = path.join(
      dir,
      `roster-capture-failed-${Date.now()}.png`,
    )

    await page.screenshot({ path: screenshotPath, fullPage: true })

    console.error('❌ Não encontrei a tela da escala.')
    console.error('❌ URL atual:', page.url())
    console.error('❌ Screenshot salva em:', screenshotPath)
    throw error
  }

  const flightSelectors = [
    '.event-flight',
    '[class*="event-flight"]',
    '[class*="EventFlight"]',
    '.flight-event',
    '[class*="roster-flight"]',
    '[class*="eventFlight"]',
    '[class*="flight"]',
    '[class*="Flight"]',
  ].join(', ')

  const offSelectors = [
    '.event-off',
    '.day-off',
    '[class*="day-off"]',
    '[class*="DayOff"]',
    '[class*="event-off"]',
    '[class*="roster-off"]',
    '[class*="event_rest"]',
    '.event-rest',
    '[class*="ground"]',
    '[class*="rest"]',
    '[class*="off"]',
  ].join(', ')

  const flightsRaw: RawBlock[] = await page.$$eval(flightSelectors, (els) =>
    els.map((el) => {
      let cur: Element | null = el
      let foundDate: string | null = null

      for (let i = 0; i < 14 && cur; i++) {
        if (cur instanceof HTMLElement) {
          for (const attr of ['data-date', 'data-day', 'data-cell-date', 'data-iso-date', 'date']) {
            const v = cur.getAttribute(attr)
            if (!v) continue

            const iso = v.match(/\d{4}-\d{2}-\d{2}/)
            if (iso) {
              foundDate = iso[0]
              break
            }

            if (/\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?/.test(v)) {
              foundDate = v.trim()
              break
            }
          }
        }

        if (foundDate) break
        cur = cur.parentElement
      }

      return {
        rawText: (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
        className: (el as HTMLElement).className?.toString?.() ?? '',
        date: foundDate,
      }
    }),
  )

  const daysOffRaw: RawBlock[] = await page.$$eval(offSelectors, (els) =>
    els.map((el) => {
      let cur: Element | null = el
      let foundDate: string | null = null

      for (let i = 0; i < 14 && cur; i++) {
        if (cur instanceof HTMLElement) {
          for (const attr of ['data-date', 'data-day', 'data-cell-date', 'data-iso-date', 'date']) {
            const v = cur.getAttribute(attr)
            if (!v) continue

            const iso = v.match(/\d{4}-\d{2}-\d{2}/)
            if (iso) {
              foundDate = iso[0]
              break
            }

            if (/\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?/.test(v)) {
              foundDate = v.trim()
              break
            }
          }
        }

        if (foundDate) break
        cur = cur.parentElement
      }

      return {
        rawText: (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
        className: (el as HTMLElement).className?.toString?.() ?? '',
        date: foundDate,
      }
    }),
  )

  console.log('✈️ Blocos de voo encontrados:', flightsRaw.length)
  console.log('🛌 Blocos de folga encontrados:', daysOffRaw.length)

  const rosterJson = normalizeBlocks(flightsRaw, daysOffRaw)

  console.log('✅ Voos normalizados:', rosterJson.flights.length)
  console.log('✅ Folgas normalizadas:', rosterJson.daysOff.length)

  const pdfBuffer = buildEscalaXRosterPdf(rosterJson)

  let pdfPath: string | null = null
  try {
    const dir = path.join(process.cwd(), '.playwright')
    fs.mkdirSync(dir, { recursive: true })
    pdfPath = path.join(dir, `escalax-roster-${Date.now()}.pdf`)
    fs.writeFileSync(pdfPath, pdfBuffer)
    console.log('📄 PDF salvo em:', pdfPath)
  } catch {
    pdfPath = null
  }

  return { rosterJson, pdfBuffer, pdfPath }
}

function normalizeBlocks(
  flightsRaw: RawBlock[],
  daysOffRaw: RawBlock[],
): EcrewRosterJson {
  const extractedAt = new Date().toISOString()

  const flights: EcrewRosterFlightRow[] = flightsRaw
    .filter((b) => b.rawText)
    .map((b) => {
      const parsed = parseFlightFields(b.rawText)
      return {
        date: b.date,
        flightNumber: parsed.flightNumber,
        origin: parsed.origin,
        destination: parsed.destination,
        departureTime: parsed.departureTime,
        arrivalTime: parsed.arrivalTime,
        rawText: b.rawText,
      }
    })

  const daysOff: EcrewRosterDayOffRow[] = daysOffRaw
    .filter((b) => b.rawText)
    .map((b) => ({
      date: b.date,
      label: inferDayOffLabel(b.rawText, b.className),
      rawText: b.rawText,
    }))

  return { extractedAt, flights, daysOff }
}

function parseFlightFields(raw: string): Omit<
  EcrewRosterFlightRow,
  'date' | 'rawText'
> {
  const flightMatch = raw.match(/\b((?:LA|JJ|G3|AD|TAM)[0-9]{3,4})\b/i)
  const codes = raw.match(/\b([A-Z]{3})\b/g) ?? []
  const times = raw.match(/\b\d{1,2}[:.h]\d{2}\b/gi) ?? []

  const normTime = (t: string): string => {
    const s = t.replace(/h/gi, ':').replace('.', ':')
    const [hh, mm] = s.split(':')
    const h = Math.min(23, Math.max(0, parseInt(hh ?? '0', 10)))
    const m = Math.min(59, Math.max(0, parseInt(mm ?? '0', 10)))
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  return {
    flightNumber: flightMatch?.[1] ?? null,
    origin: codes[0] ?? null,
    destination: codes[1] ?? null,
    departureTime: times[0] ? normTime(times[0]) : null,
    arrivalTime: times[1] ? normTime(times[1]) : null,
  }
}

function inferDayOffLabel(raw: string, className: string): string | null {
  const upper = raw.toUpperCase()
  const m = upper.match(/\b(DO|GND|OFF|REST|FOLGA|DSR|VAC|DB|DR|ASB|HSB)\b/)
  if (m) return m[1]

  const cls = className.toLowerCase()
  if (cls.includes('off')) return 'OFF'
  if (cls.includes('rest')) return 'REST'
  if (cls.includes('ground')) return 'GND'

  return null
}