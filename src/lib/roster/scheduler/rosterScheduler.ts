import fs from 'node:fs/promises'
import path from 'node:path'
import cron, { type ScheduledTask } from 'node-cron'
import { runRosterAutomation } from '../roster-automation/index.ts'
import { toRosterJson } from '../roster-automation/toRosterJson.ts'
import { buildEscalaXRosterPdf } from '../output/buildEscalaXRosterPdf.ts'
import type { RosterJson } from '../types.ts'
import { buildRosterFingerprint, syncRosterToCalendar } from '../sync/calendarSync.ts'
import { sendRosterNotification } from './notifier.ts'

const DATA_DIR = path.resolve(process.cwd(), 'data')
const LAST_ROSTER_PATH = path.join(DATA_DIR, 'last-roster.json')

let runningJob: Promise<void> | null = null

function getMonthYearFileSuffix(roster: RosterJson): string {
  const firstDate = roster.flights[0]?.date ?? roster.daysOff[0]?.date
  if (!firstDate) return 'sem-data'

  const date = new Date(`${firstDate}T00:00:00`)
  const month = date.toLocaleDateString('pt-BR', {
    month: 'long',
    timeZone: 'UTC',
  })

  return `${month.toLowerCase()}-${date.getUTCFullYear()}`
}

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
}

async function loadLastRoster(): Promise<RosterJson | null> {
  try {
    const raw = await fs.readFile(LAST_ROSTER_PATH, 'utf8')
    return JSON.parse(raw) as RosterJson
  } catch {
    return null
  }
}

async function saveLastRoster(roster: RosterJson): Promise<void> {
  await fs.writeFile(LAST_ROSTER_PATH, JSON.stringify(roster, null, 2), 'utf8')
}

function hasRosterChanges(current: RosterJson, previous: RosterJson | null): boolean {
  if (!previous) return true
  return buildRosterFingerprint(current) !== buildRosterFingerprint(previous)
}

async function captureCurrentRoster(): Promise<RosterJson> {
  const headless = process.env.NODE_ENV === 'production'
  console.log(`🔄 Iniciando captura Playwright (headless: ${headless}).`)
  const captureResult = await runRosterAutomation({ headless })
  return toRosterJson(captureResult.rosterJson)
}

async function saveRosterPdf(roster: RosterJson): Promise<string> {
  const filename = `roster-${getMonthYearFileSuffix(roster)}.pdf`
  const outputPath = path.join(DATA_DIR, filename)
  const pdfBuffer = await buildEscalaXRosterPdf(roster)
  await fs.writeFile(outputPath, pdfBuffer)
  return outputPath
}

export async function runRosterJob(): Promise<void> {
  if (runningJob) {
    console.log('🔄 Job já está em execução, ignorando novo disparo.')
    return runningJob
  }

  runningJob = (async () => {
    try {
      console.log('🔄 Iniciando job de atualização de escala...')
      await ensureDataDir()

      const currentRoster = await captureCurrentRoster()
      const previousRoster = await loadLastRoster()

      if (!hasRosterChanges(currentRoster, previousRoster)) {
        console.log('✅ Sem mudanças na escala. Job finalizado.')
        return
      }

      console.log('✅ Mudanças detectadas na escala.')
      const pdfPath = await saveRosterPdf(currentRoster)
      console.log(`✅ PDF salvo em ${pdfPath}`)

      const calendarId = process.env.GOOGLE_CALENDAR_ID?.trim() || 'primary'
      await syncRosterToCalendar(currentRoster, calendarId)

      await sendRosterNotification({
        pdfPath,
        roster: currentRoster,
      })

      await saveLastRoster(currentRoster)
      console.log('✅ last-roster.json atualizado com sucesso.')
    } catch (error) {
      console.error('❌ Erro no job de atualização da escala:', error)
      throw error
    } finally {
      runningJob = null
    }
  })()

  return runningJob
}

export function startRosterScheduler(): ScheduledTask {
  const cronExpression = process.env.ROSTER_CHECK_CRON?.trim() || '0 3 * * *'
  const timezone = 'America/Sao_Paulo'

  console.log(`🔄 Agendando job de escala com cron "${cronExpression}" (${timezone}).`)

  const task = cron.schedule(
    cronExpression,
    () => {
      void runRosterJob().catch((error) => {
        console.error('❌ Erro na execução agendada do roster:', error)
      })
    },
    { timezone },
  )

  return task
}
