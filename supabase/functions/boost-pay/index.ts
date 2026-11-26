// Pagamento do impulsionamento por Pix (Mercado Pago).
// - action "create": gera o Pix (QR Code + copia e cola) de uma campanha do próprio político.
// - action "check": pergunta ao Mercado Pago se já foi pago e, se sim, coloca a campanha no ar.
// O token do Mercado Pago fica no Supabase (Edge Functions > Secrets) com o nome MP_ACCESS_TOKEN.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const mpToken = Deno.env.get('MP_ACCESS_TOKEN')?.trim();
    if (!mpToken) return json({ error: 'Pagamento ainda não configurado (falta o MP_ACCESS_TOKEN no Supabase).' }, 500);

    const auth = req.headers.get('Authorization') ?? '';
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: 'Entre na sua conta.' }, 401);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { action, campaignId } = await req.json().catch(() => ({}));
    if (!campaignId) return json({ error: 'Campanha não informada.' }, 400);

    const { data: c } = await admin.from('boost_campaigns').select('*').eq('id', campaignId).maybeSingle();
    if (!c || c.user_id !== user.id) return json({ error: 'Campanha não encontrada.' }, 404);

    if (action === 'check') {
      if (c.status !== 'pending_payment') return json({ status: c.status });
      if (!c.payment_id) return json({ status: c.status });
      const r = await fetch(`https://api.mercadopago.com/v1/payments/${c.payment_id}`, { headers: { Authorization: `Bearer ${mpToken}` } });
      const p = await r.json();
      if (p?.status === 'approved' && p?.external_reference === c.id) {
        await admin.rpc('boost_mark_paid', { p_campaign: c.id, p_method: 'pix', p_payment: String(p.id) });
        const { data: after } = await admin.from('boost_campaigns').select('status').eq('id', c.id).maybeSingle();
        return json({ status: after?.status ?? 'active' });
      }
      return json({ status: c.status, payment: p?.status ?? null });
    }

    // create: gera (ou reaproveita) o Pix
    if (c.status !== 'pending_payment') return json({ error: 'Essa campanha já foi paga.' }, 400);
    if (c.payment_id && c.pix_copy_paste) return json({ qr: c.pix_qr_base64, copyPaste: c.pix_copy_paste, paymentId: c.payment_id });

    const base = Deno.env.get('SUPABASE_URL')!;
    const r = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${mpToken}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': `boost-${c.id}` },
      body: JSON.stringify({
        transaction_amount: Number(c.amount),
        description: 'Impulsionamento Splitter',
        payment_method_id: 'pix',
        external_reference: c.id,
        notification_url: `${base}/functions/v1/boost-webhook`,
        date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString().replace('Z', '-00:00'),
        payer: { email: user.email },
      }),
    });
    const p = await r.json();
    const td = p?.point_of_interaction?.transaction_data;
    if (!r.ok || !td?.qr_code) return json({ error: `Mercado Pago recusou: ${p?.message ?? r.status}` }, 502);

    await admin
      .from('boost_campaigns')
      .update({ payment_id: String(p.id), pix_qr_base64: td.qr_code_base64, pix_copy_paste: td.qr_code })
      .eq('id', c.id);
    return json({ qr: td.qr_code_base64, copyPaste: td.qr_code, paymentId: String(p.id) });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
