import Fastify from 'fastify';
import { config } from './config.js';
import { getUserIdFromJwt } from './auth.js';
import { getServiceClient } from './db.js';
import { log } from './logger.js';
import { startConnectFlow, runSyncFlow } from './providers/latam/latamAutomation.js';
import { startGolConnectFlow } from './providers/gol/golAutomation.js';
import { startAzulConnectFlow } from './providers/azul/azulAutomation.js';

const app = Fastify({ logger: false });

app.addHook('onRequest', async (req, reply) => {
  const origin = req.headers.origin;
  const allowed = config.corsOrigins();
  if (origin && allowed.includes(origin)) {
    reply.header('Access-Control-Allow-Origin', origin);
    reply.header('Vary', 'Origin');
    reply.header('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept');
    reply.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  }
  if (req.method === 'OPTIONS') {
    reply.status(204).send();
  }
});

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getErrorStatus(error: unknown): number {
  if (typeof error === 'object' && error !== null && 'statusCode' in error) {
    const statusCode = (error as { statusCode?: unknown }).statusCode;
    if (typeof statusCode === 'number') return statusCode;
  }
  return 500;
}

/** Garante que erros do Fastify retornem o mesmo envelope {error} das rotas. */
app.setErrorHandler((error, req, reply) => {
  const status = getErrorStatus(error);
  const message = getErrorMessage(error);
  const stack = error instanceof Error ? (error.stack ?? '').slice(0, 800) : '';
  let bodySnippet = '';
  try {
    const raw = JSON.stringify(req.body);
    if (raw) bodySnippet = raw.slice(0, 300);
  } catch {
    bodySnippet = '[unserializable]';
  }
  log('api', 'error', 'fastify_error', {
    status,
    message,
    stack,
    method: req.method,
    url: req.url,
    body: bodySnippet,
  });
  // Expõe a mensagem real temporariamente (remover após diagnóstico)
  const msg =
    status === 400
      ? `Requisição inválida: ${message}`
      : `Erro interno no worker: ${message}`;
  return reply.status(status).send({ error: msg });
});

async function requireUser(auth: string | undefined): Promise<string | null> {
  return getUserIdFromJwt(auth);
}

type RunRow = { id: string; finished_at: string | null; started_at: string };

/** Execução mais recente da sessão. Inclui started_at para deteção de runs presas. */
async function latestRunForSession(
  supabase: ReturnType<typeof getServiceClient>,
  sessionId: string,
): Promise<RunRow | null> {
  const { data: rows } = await supabase
    .from('automation_runs')
    .select('id, finished_at, started_at')
    .eq('session_id', sessionId)
    .order('started_at', { ascending: false })
    .limit(1);
  const r = rows?.[0] as RunRow | undefined;
  return r ?? null;
}

/** Run presa: sem finished_at e iniciada há mais de 35 min (além do timeout de SSO de 25 min). */
function isStaleRun(run: RunRow): boolean {
  if (run.finished_at) return false;
  return Date.now() - new Date(run.started_at).getTime() > 35 * 60_000;
}

async function finalizeStaleRun(
  supabase: ReturnType<typeof getServiceClient>,
  run: RunRow,
  sessionId: string,
): Promise<void> {
  const now = new Date().toISOString();
  const msg = 'Run anterior expirou sem resposta — iniciando nova tentativa';
  log('api', 'warn', 'stale_run_finalized', { runId: run.id, sessionId });
  await supabase
    .from('automation_runs')
    .update({ status: 'error', error_message: msg, finished_at: now, updated_at: now })
    .eq('id', run.id);
  await supabase
    .from('automation_sessions')
    .update({ status: 'error', last_error: msg, updated_at: now })
    .eq('id', sessionId);
}

/** Inicia browser dirigido ao portal — o utilizador autentica; gravamos storageState ao detetar home. */
app.post('/v1/latam/connect', async (req, reply) => {
  log('api', 'info', 'connect_request', { method: req.method, url: req.url });

  const userId = await requireUser(req.headers.authorization);
  if (!userId) {
    log('api', 'warn', 'connect_auth_failed', { hasHeader: Boolean(req.headers.authorization) });
    return reply.status(401).send({ error: 'Não autorizado' });
  }
  log('api', 'info', 'connect_auth_ok', { userId });

  const supabase = getServiceClient();

  const { data: existingSess, error: sessLookupErr } = await supabase
    .from('automation_sessions')
    .select('id')
    .eq('user_id', userId)
    .eq('provider', 'latam')
    .maybeSingle();
  log('api', 'info', 'connect_existing_session', {
    found: Boolean(existingSess?.id),
    sessionId: existingSess?.id ?? null,
    lookupError: sessLookupErr?.message ?? null,
  });

  if (existingSess?.id) {
    const last = await latestRunForSession(supabase, (existingSess as { id: string }).id);
    if (last && !last.finished_at) {
      if (isStaleRun(last)) {
        await finalizeStaleRun(supabase, last, (existingSess as { id: string }).id);
      } else {
        log('api', 'info', 'connect_skipped_in_flight', { sessionId: existingSess.id, runId: last.id });
        return { sessionId: existingSess.id, runId: last.id, resumed: true as const };
      }
    }
  }

  const { data: session, error: se } = await supabase
    .from('automation_sessions')
    .upsert(
      {
        user_id: userId,
        provider: 'latam',
        status: 'portal_connecting',
        last_error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,provider' },
    )
    .select('id')
    .single();

  if (se || !session) {
    log('api', 'error', 'connect_session_upsert_failed', { message: se?.message ?? 'no data' });
    return reply.status(500).send({ error: se?.message ?? 'Falha ao criar sessão' });
  }

  const sessionId = (session as { id: string }).id;
  log('api', 'info', 'connect_session_upserted', { sessionId });

  await supabase
    .from('user_roster_connection')
    .update({ automation_session_id: sessionId, updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  const { data: run, error: re } = await supabase
    .from('automation_runs')
    .insert({
      session_id: sessionId,
      user_id: userId,
      status: 'portal_connecting',
      step_logs: [],
    })
    .select('id')
    .single();

  if (re || !run) {
    log('api', 'error', 'connect_run_insert_failed', { message: re?.message ?? 'no data', sessionId });
    return reply.status(500).send({ error: re?.message ?? 'Falha ao criar execução' });
  }

  const runId = (run as { id: string }).id;
  log('api', 'info', 'connect_run_created', { sessionId, runId });

  log('api', 'info', 'connect_flow_dispatched', { sessionId, runId });
  void startConnectFlow({ userId, sessionId, runId }).catch(async (e) => {
    const msg = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? (e.stack ?? '').slice(0, 800) : '';
    log('api', 'error', 'connect_flow_unhandled', { sessionId, runId, message: msg, stack });
    const sb = getServiceClient();
    const now = new Date().toISOString();
    await sb
      .from('automation_runs')
      .update({ status: 'error', error_message: msg, finished_at: now, updated_at: now })
      .eq('id', runId);
    await sb
      .from('automation_sessions')
      .update({ status: 'error', last_error: msg, updated_at: now })
      .eq('id', sessionId);
  });

  return { sessionId, runId };
});

/** Sincronização manual: reutiliza storageState, navega ao iFlight, descarrega PDF e importa. */
app.post('/v1/latam/sync', async (req, reply) => {
  log('api', 'info', 'sync_request', { method: req.method, url: req.url });

  const userId = await requireUser(req.headers.authorization);
  if (!userId) {
    log('api', 'warn', 'sync_auth_failed', { hasHeader: Boolean(req.headers.authorization) });
    return reply.status(401).send({ error: 'Não autorizado' });
  }
  log('api', 'info', 'sync_auth_ok', { userId });

  const body = (req.body ?? {}) as { sessionId?: string };
  const sessionId = body.sessionId?.trim();
  if (!sessionId) {
    log('api', 'warn', 'sync_missing_session_id', { bodyKeys: Object.keys(body) });
    return reply.status(400).send({ error: 'sessionId obrigatório' });
  }
  log('api', 'info', 'sync_body_parsed', { sessionId });

  const supabase = getServiceClient();
  const { data: sess, error } = await supabase
    .from('automation_sessions')
    .select('id, user_id')
    .eq('id', sessionId)
    .single();

  if (error || !sess || (sess as { user_id: string }).user_id !== userId) {
    log('api', 'warn', 'sync_session_invalid', {
      sessionId,
      dbError: error?.message ?? null,
      found: Boolean(sess),
      ownerMismatch: sess ? (sess as { user_id: string }).user_id !== userId : null,
    });
    return reply.status(403).send({ error: 'Sessão inválida' });
  }

  const sid = (sess as { id: string }).id;
  log('api', 'info', 'sync_session_found', { sessionId: sid });

  const last = await latestRunForSession(supabase, sid);
  if (last && !last.finished_at) {
    if (isStaleRun(last)) {
      await finalizeStaleRun(supabase, last, sid);
    } else {
      log('api', 'info', 'sync_skipped_in_flight', { sessionId: sid, runId: last.id });
      return { sessionId: sid, runId: last.id, resumed: true as const };
    }
  }

  const { data: run, error: re } = await supabase
    .from('automation_runs')
    .insert({
      session_id: sessionId,
      user_id: userId,
      status: 'roster_downloading',
      step_logs: [],
    })
    .select('id')
    .single();

  if (re || !run) {
    log('api', 'error', 'sync_run_insert_failed', { message: re?.message ?? 'no data', sessionId });
    return reply.status(500).send({ error: re?.message ?? 'Falha ao criar execução' });
  }

  const runId = (run as { id: string }).id;
  log('api', 'info', 'sync_run_created', { sessionId, runId });

  log('api', 'info', 'sync_flow_dispatched', { sessionId, runId });
  void runSyncFlow({ userId, sessionId, runId }).catch(async (e) => {
    const msg = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? (e.stack ?? '').slice(0, 800) : '';
    log('api', 'error', 'sync_flow_unhandled', { sessionId, runId, message: msg, stack });
    const sb = getServiceClient();
    const now = new Date().toISOString();
    await sb
      .from('automation_runs')
      .update({ status: 'error', error_message: msg, finished_at: now, updated_at: now })
      .eq('id', runId);
    await sb
      .from('automation_sessions')
      .update({ status: 'error', last_error: msg, updated_at: now })
      .eq('id', sessionId);
  });

  return { sessionId, runId };
});

app.get('/v1/:provider/session/:sessionId', async (req, reply) => {
  const userId = await requireUser(req.headers.authorization);
  if (!userId) return reply.status(401).send({ error: 'Não autorizado' });

  const { provider, sessionId } = req.params as { provider: string; sessionId: string };
  if (!['latam', 'gol', 'azul'].includes(provider)) {
    return reply.status(404).send({ error: 'provider inválido' });
  }
  const supabase = getServiceClient();

  const { data: session, error: sErr } = await supabase
    .from('automation_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .eq('provider', provider)
    .maybeSingle();

  if (sErr || !session) return reply.status(404).send({ error: 'Não encontrado' });

  const { data: runs } = await supabase
    .from('automation_runs')
    .select('*')
    .eq('session_id', sessionId)
    .order('started_at', { ascending: false })
    .limit(5);

  return { session, recentRuns: runs ?? [] };
});

app.post('/v1/gol/connect', async (req, reply) => {
  const userId = await requireUser(req.headers.authorization);
  if (!userId) return reply.status(401).send({ error: 'Não autorizado' });

  const supabase = getServiceClient();
  const { data: existingSess } = await supabase
    .from('automation_sessions')
    .select('id')
    .eq('user_id', userId)
    .eq('provider', 'gol')
    .maybeSingle();

  if (existingSess?.id) {
    const last = await latestRunForSession(supabase, (existingSess as { id: string }).id);
    if (last && !last.finished_at) {
      log('api', 'info', 'connect_skipped_in_flight', { sessionId: existingSess.id, runId: last.id, provider: 'gol' });
      return { sessionId: existingSess.id, runId: last.id, resumed: true as const };
    }
  }

  const { data: session, error: se } = await supabase
    .from('automation_sessions')
    .upsert(
      {
        user_id: userId,
        provider: 'gol',
        status: 'portal_connecting',
        last_error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,provider' },
    )
    .select('id')
    .single();

  if (se || !session) {
    return reply.status(500).send({ error: se?.message ?? 'Falha ao criar sessão' });
  }

  const sessionId = (session as { id: string }).id;
  await supabase
    .from('user_roster_connection')
    .update({ automation_session_id: sessionId, updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  const { data: run, error: re } = await supabase
    .from('automation_runs')
    .insert({ session_id: sessionId, user_id: userId, status: 'portal_connecting', step_logs: [] })
    .select('id')
    .single();

  if (re || !run) return reply.status(500).send({ error: re?.message ?? 'Falha ao criar execução' });

  const runId = (run as { id: string }).id;
  void startGolConnectFlow({ userId, sessionId, runId }).catch((e) =>
    log('api', 'error', 'connect_flow_unhandled', { message: e instanceof Error ? e.message : String(e) }),
  );

  return { sessionId, runId };
});

app.post('/v1/azul/connect', async (req, reply) => {
  const userId = await requireUser(req.headers.authorization);
  if (!userId) return reply.status(401).send({ error: 'Não autorizado' });

  const supabase = getServiceClient();
  const { data: existingSess } = await supabase
    .from('automation_sessions')
    .select('id')
    .eq('user_id', userId)
    .eq('provider', 'azul')
    .maybeSingle();

  if (existingSess?.id) {
    const last = await latestRunForSession(supabase, (existingSess as { id: string }).id);
    if (last && !last.finished_at) {
      log('api', 'info', 'connect_skipped_in_flight', { sessionId: existingSess.id, runId: last.id, provider: 'azul' });
      return { sessionId: existingSess.id, runId: last.id, resumed: true as const };
    }
  }

  const { data: session, error: se } = await supabase
    .from('automation_sessions')
    .upsert(
      {
        user_id: userId,
        provider: 'azul',
        status: 'portal_connecting',
        last_error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,provider' },
    )
    .select('id')
    .single();

  if (se || !session) {
    return reply.status(500).send({ error: se?.message ?? 'Falha ao criar sessão' });
  }

  const sessionId = (session as { id: string }).id;
  await supabase
    .from('user_roster_connection')
    .update({ automation_session_id: sessionId, updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  const { data: run, error: re } = await supabase
    .from('automation_runs')
    .insert({ session_id: sessionId, user_id: userId, status: 'portal_connecting', step_logs: [] })
    .select('id')
    .single();

  if (re || !run) return reply.status(500).send({ error: re?.message ?? 'Falha ao criar execução' });

  const runId = (run as { id: string }).id;
  void startAzulConnectFlow({ userId, sessionId, runId }).catch((e) =>
    log('api', 'error', 'connect_flow_unhandled', { message: e instanceof Error ? e.message : String(e) }),
  );

  return { sessionId, runId };
});

app.get('/health', async () => ({ ok: true }));

/** Diagnóstico de configuração — sem segredos (nenhuma chave ou password). */
app.get('/v1/status', async () => ({
  ok: true,
  worker: 'roster-automation',
  port: config.port,
  headless: config.headless(),
  latamPortalConfigured: Boolean(config.latamPortalLoginUrl()),
  latamSabUrl: config.latamPortalSabUrl(),
  iflightPrimaryUrl: config.iflightDeepLinkUrl(),
  iflightFallbackUrl: 'https://iflightla.ibsplc.aero/iflight',
  ecrewConfigured: Boolean(config.latamEcredEntryUrl()),
  dataDir: config.dataDir(),
}));

const port = config.port;
app.listen({ port, host: '0.0.0.0' }).then(() => {
  log('server', 'info', 'listening', { port });
});
