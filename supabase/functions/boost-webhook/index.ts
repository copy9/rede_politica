// Aviso do Mercado Pago quando um Pix é pago. Confere o pagamento direto no Mercado Pago
// (não confia no que chegou no aviso) e coloca a campanha de impulsionamento no ar.
// Publicar SEM verificação de login: supabase functions deploy boost-webhook --no-verify-jwt
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

Deno.serve(async (req) => {
  try {
    const mpToken = Deno.env.get('MP_ACCESS_TOKEN')?.trim();
    if (!mpToken) return new Response('sem token', { status: 200 });
    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const type = body?.type ?? url.searchParams.get('type') ?? url.searchParams.get('topic');
    const id = body?.data?.id ?? url.searchParams.get('data.id') ?? url.searchParams.get('id');
    if (type !== 'payment' || !id) return new Response('ignorado', { status: 200 });

    const r = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, { headers: { Authorization: `Bearer ${mpToken}` } });
    const p = await r.json();
    if (p?.status !== 'approved' || !p?.external_reference) return new Response('ok', { status: 200 });

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    await admin.rpc('boost_mark_paid', { p_campaign: p.external_reference, p_method: 'pix', p_payment: String(p.id) });
    return new Response('ok', { status: 200 });
  } catch {
    // responde 200 para o Mercado Pago não ficar reenviando sem parar
    return new Response('erro', { status: 200 });
  }
});
