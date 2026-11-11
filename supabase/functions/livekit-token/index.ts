// Gera o "ingresso" (token) para entrar na sala de vídeo de uma batalha no LiveKit.
// - Só quem está logado recebe.
// - Quem está na batalha (quem abriu e o desafiado) pode transmitir câmera e microfone.
// - A plateia só assiste.
// A chave e o segredo do LiveKit ficam guardados no Supabase (Edge Functions > Secrets),
// com os nomes LIVEKIT_API_KEY e LIVEKIT_API_SECRET. Nunca vão para o app.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const b64url = (data: Uint8Array | string) => {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  let s = '';
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

async function signJwt(payload: Record<string, unknown>, secret: string) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${header}.${body}`)));
  return `${header}.${body}.${b64url(sig)}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const apiKey = Deno.env.get('LIVEKIT_API_KEY');
    const apiSecret = Deno.env.get('LIVEKIT_API_SECRET');
    if (!apiKey || !apiSecret) return json({ error: 'LiveKit não configurado no Supabase (faltam os secrets).' }, 500);

    const auth = req.headers.get('Authorization') ?? '';
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData, error: userError } = await supabase.auth.getUser();
    const user = userData?.user;
    if (userError || !user) return json({ error: 'Entre na sua conta.' }, 401);

    const { battleId } = await req.json().catch(() => ({ battleId: null }));
    if (!battleId || typeof battleId !== 'string') return json({ error: 'Batalha não informada.' }, 400);

    // lê a batalha com as regras do banco (quem bloqueou o host não enxerga)
    const { data: battle } = await supabase.from('battles').select('id, host_id, opponent_id, status').eq('id', battleId).maybeSingle();
    if (!battle) return json({ error: 'Batalha não encontrada.' }, 404);
    if (battle.status === 'ended') return json({ error: 'A batalha já terminou.' }, 410);

    const { data: profile } = await supabase.from('profiles').select('username, name').eq('id', user.id).maybeSingle();
    const speaker = user.id === battle.host_id || user.id === battle.opponent_id;
    const now = Math.floor(Date.now() / 1000);
    const token = await signJwt(
      {
        iss: apiKey,
        sub: user.id,
        name: profile?.name ?? 'Participante',
        nbf: now - 10,
        exp: now + 2 * 60 * 60,
        metadata: JSON.stringify({ username: profile?.username ?? '' }),
        video: {
          room: `batalha-${battle.id}`,
          roomJoin: true,
          canSubscribe: true,
          canPublish: speaker,
          canPublishData: false,
        },
      },
      apiSecret,
    );
    return json({ token, speaker });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
