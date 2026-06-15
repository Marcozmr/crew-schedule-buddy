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

async function requireUser(auth: string | undefined): Promise<string | null> {
  return getUserIdFromJwt(auth);
}

async function latestRunForSession(
  supabase: ReturnType<typeof getServiceClient>,
  sessionId: string,
): Promise<{ id: string; finished_at: string | null } | null> {
  const { data: rows } = await supabase
    .from('automation_runs')
    .select('id, finished_at')
    .eq('session_id', sessionId)
    .order('started_at', { ascending: false })
    .limit(1);
  const r = rows?.[0] as { id: string; finished_at: string | null } | undefined;
  return r ?? null;
}

/** Inicia browser dirigido ao portal — o utilizador autentica; gravamos storageState ao detetar home. */
app.post('/v1/latam/connect', async (req, reply) => {
  const userId = await requireUser(req.headers.authorization);
  if (!userId) return reply.status(401).send({ error: 'Não autorizado' });

  const supabase = getServiceClient();

  const { data: existingSess } = await supabase
    .from('automation_sessions')
    .select('id')
    .eq('user_id', userId)
    .eq('provider', 'latam')
    .maybeSingle();

  if (existingSess?.id) {
    const last = await latestRunForSession(supabase, (existingSess as { id: string }).id);
    if (last && !last.finished_at) {
      log('api', 'info', 'connect_skipped_in_flight', { sessionId: existingSess.id, runId: last.id });
      return { sessionId: existingSess.id, runId: last.id, resumed: true as const };
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
    log('api', 'error', 'session_upsert_failed', { message: se?.message });
    return reply.status(500).send({ error: se?.message ?? 'Falha ao criar sessão' });
  }

  const sessionId = (session as { id: string }).id;

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
    return reply.status(500).send({ error: re?.message ?? 'Falha ao criar execução' });
  }

  const runId = (run as { id: string }).id;

  void startConnectFlow({ userId, sessionId, runId }).catch((e) =>
    log('api', 'error', 'connect_flow_unhandled', { message: e instanceof Error ? e.message : String(e) }),
  );

  return { sessionId, runId };
});

/** Sincronização manual: reutiliza storageState, navega ao iFlight, descarrega PDF e importa. */
app.post('/v1/latam/sync', async (req, reply) => {
  const userId = await requireUser(req.headers.authorization);
  if (!userId) return reply.status(401).send({ error: 'Não autorizado' });

  const body = (req.body ?? {}) as { sessionId?: string };
  const sessionId = body.sessionId?.trim();
  if (!sessionId) return reply.status(400).send({ error: 'sessionId obrigatório' });

  const supabase = getServiceClient();
  const { data: sess, error } = await supabase
    .from('automation_sessions')
    .select('id, user_id')
    .eq('id', sessionId)
    .single();

  if (error || !sess || (sess as { user_id: string }).user_id !== userId) {
    return reply.status(403).send({ error: 'Sessão inválida' });
  }

  const sid = (sess as { id: string }).id;
  const last = await latestRunForSession(supabase, sid);
  if (last && !last.finished_at) {
    log('api', 'info', 'sync_skipped_in_flight', { sessionId: sid, runId: last.id });
    return { sessionId: sid, runId: last.id, resumed: true as const };
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

  if (re || !run) return reply.status(500).send({ error: re?.message ?? 'Falha ao criar execução' });

  const runId = (run as { id: string }).id;

  void runSyncFlow({ userId, sessionId, runId }).catch((e) =>
    log('api', 'error', 'sync_flow_unhandled', { message: e instanceof Error ? e.message : String(e) }),
  );

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
