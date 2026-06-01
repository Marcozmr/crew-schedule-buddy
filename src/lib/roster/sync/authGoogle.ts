import fs from 'node:fs/promises'
import path from 'node:path'
import { exec } from 'node:child_process'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { google } from 'googleapis'

const GOOGLE_SCOPES = ['https://www.googleapis.com/auth/calendar.events']
const CREDENTIALS_PATH = path.resolve(process.cwd(), 'credentials.json')
const DEFAULT_REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob'

interface StoredGoogleCredentials {
  clientId: string
  clientSecret: string
  redirectUri: string
  refreshToken?: string
}

function openBrowser(url: string): Promise<void> {
  const command =
    process.platform === 'win32'
      ? `start "" "${url}"`
      : process.platform === 'darwin'
        ? `open "${url}"`
        : `xdg-open "${url}"`

  return new Promise((resolve, reject) => {
    exec(command, (error) => {
      if (error) {
        reject(error)
        return
      }
      resolve()
    })
  })
}

async function loadStoredCredentials(): Promise<StoredGoogleCredentials | null> {
  try {
    const raw = await fs.readFile(CREDENTIALS_PATH, 'utf8')
    const parsed = JSON.parse(raw) as Partial<StoredGoogleCredentials>
    if (!parsed.clientId || !parsed.clientSecret) return null

    return {
      clientId: parsed.clientId,
      clientSecret: parsed.clientSecret,
      redirectUri: parsed.redirectUri ?? DEFAULT_REDIRECT_URI,
      refreshToken: parsed.refreshToken,
    }
  } catch {
    return null
  }
}

function buildCredentialsFromEnv(): StoredGoogleCredentials {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()

  if (!clientId || !clientSecret) {
    throw new Error(
      'GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET são obrigatórios para autenticar com Google Calendar.',
    )
  }

  return {
    clientId,
    clientSecret,
    redirectUri: DEFAULT_REDIRECT_URI,
  }
}

async function saveCredentials(credentials: StoredGoogleCredentials): Promise<void> {
  await fs.writeFile(CREDENTIALS_PATH, JSON.stringify(credentials, null, 2), 'utf8')
}

async function requestRefreshToken(
  oauth2Client: InstanceType<typeof google.auth.OAuth2>,
): Promise<string> {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: GOOGLE_SCOPES,
    prompt: 'consent',
  })

  console.log('🔄 Abrindo navegador para autenticação Google...')
  console.log(`📅 URL de autenticação: ${authUrl}`)

  try {
    await openBrowser(authUrl)
  } catch (error) {
    console.warn('❌ Não foi possível abrir o navegador automaticamente.')
    console.warn(error)
  }

  const rl = createInterface({ input, output })
  try {
    const code = (await rl.question('Cole o código de autorização do Google aqui: ')).trim()
    if (!code) {
      throw new Error('Código de autorização não informado.')
    }

    const tokenResponse = await oauth2Client.getToken(code)
    const refreshToken = tokenResponse.tokens.refresh_token

    if (!refreshToken) {
      throw new Error(
        'Google não retornou refresh token. Remova o app autorizado na conta Google e tente novamente.',
      )
    }

    return refreshToken
  } finally {
    rl.close()
  }
}

export async function getGoogleAuthClient(): Promise<InstanceType<typeof google.auth.OAuth2>> {
  const storedCredentials = await loadStoredCredentials()
  const credentials = storedCredentials ?? buildCredentialsFromEnv()

  const oauth2Client = new google.auth.OAuth2(
    credentials.clientId,
    credentials.clientSecret,
    credentials.redirectUri,
  )

  let refreshToken = credentials.refreshToken
  if (!refreshToken) {
    refreshToken = await requestRefreshToken(oauth2Client)
    await saveCredentials({ ...credentials, refreshToken })
    console.log('✅ Refresh token salvo em credentials.json.')
  }

  oauth2Client.setCredentials({ refresh_token: refreshToken })
  return oauth2Client
}
