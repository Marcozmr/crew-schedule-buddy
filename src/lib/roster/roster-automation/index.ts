import type { Page } from 'playwright'
import { createBrowser } from './playwright-runner.ts'
import { captureRoster } from './ecrew-capture.ts'

const ENTRY_URLS = [
  'https://iflightla.ibsplc.aero/iflight-crew/web/getMainPage',
  'https://portal.latam.com/',
]

async function openBestEntry(page: Page): Promise<string> {
  let lastError: unknown = null

  for (const url of ENTRY_URLS) {
    try {
      console.log(`🌐 Tentando abrir: ${url}`)

      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 120000,
      })

      console.log(`✅ Entrada aberta com sucesso: ${url}`)
      return url
    } catch (error) {
      lastError = error
      console.warn(`⚠️ Falhou ao abrir: ${url}`)
      console.warn(error)
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Nenhuma URL de entrada abriu corretamente.')
}

interface RunRosterAutomationOptions {
  headless?: boolean
}

export async function runRosterAutomation(options: RunRosterAutomationOptions = {}) {
  const headless = options.headless ?? process.env.NODE_ENV === 'production'
  const { context, page } = await createBrowser(headless)

  try {
    const openedUrl = await openBestEntry(page)

    if (openedUrl.includes('iflight')) {
      console.log('✈️ iFlight aberto diretamente.')
    } else {
      console.log('🔐 Portal LATAM aberto.')
      console.log('Faça login e depois siga para o iFlight.')
    }

    console.log('📋 O script vai abrir Roster -> Roster Calendar e extrair a escala.')

    const result = await captureRoster(page)

    console.log('✅ Resultado da captura:')
    console.dir(result, { depth: null })

    return result
  } catch (error) {
    console.error('❌ Erro na automação:', error)
    throw error
  } finally {
    await context.close()
  }
}