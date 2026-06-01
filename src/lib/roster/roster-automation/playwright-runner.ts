import fs from 'node:fs'
import path from 'node:path'
import {
  chromium,
  type BrowserContext,
  type Page,
} from 'playwright'

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

function resolveChromeExecutablePath(): string | undefined {
  const fromEnv = process.env.CHROME_PATH?.trim()
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv

  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(
      process.env.LOCALAPPDATA ?? '',
      'Google\\Chrome\\Application\\chrome.exe',
    ),
  ].filter(Boolean)

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) return candidate
  }

  return undefined
}

export async function createBrowser(headless = false): Promise<{
  context: BrowserContext
  page: Page
}> {
  const userDataDir = path.resolve(
    process.cwd(),
    '.playwright',
    'latam-ecrew-profile',
  )

  fs.mkdirSync(userDataDir, { recursive: true })

  const chromeExecutablePath = resolveChromeExecutablePath()

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless,
    executablePath: chromeExecutablePath,
    channel: chromeExecutablePath ? undefined : 'chrome',
    acceptDownloads: true,
    userAgent: DEFAULT_USER_AGENT,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    viewport: { width: 1366, height: 768 },
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-http2',
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  })

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    })
  })

  const existingPage = context.pages()[0]
  const page = existingPage ?? (await context.newPage())

  return { context, page }
}