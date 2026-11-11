// Teste das regras do banco: cria 3 contas de teste, testa tudo e mostra PASS/FAIL.
// Rodar: node scripts/testar-banco.mjs  (depois apague as contas de teste no painel do Supabase)
import { createClient } from '@supabase/supabase-js';
const URL = 'https://rqpxnpynkyeocxmjyzav.supabase.co', KEY = 'sb_publishable_9ORBBumPUrkUHFycGu5_aA_tVIcnDFR';
const tag = Date.now().toString(36);
const out = []; const ok = (n, c, x = '') => out.push(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  → ' + x : ''}`);
async function user(u, meta) {
  const c = createClient(URL, KEY, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signUp({ email: `${u}.${tag}@example.com`, password: 'Teste12345', options: { data: { username: `${u}_${tag}`, name: u.toUpperCase(), ...meta } } });
  if (error) throw new Error(u + ': ' + error.message);
  return { c, id: data.user.id, session: !!data.session };
}
try {
  const A = await user('ana', { account_type: 'politico', role: 'Vereadora', city: 'Recife', state: 'pe' });
  const B = await user('beto', { birth_year: '1990', city: 'Olinda', state: 'PE' });
  const Cc = await user('caio', {});
  ok('cadastro entra direto (sem e-mail)', A.session && B.session && Cc.session);
  const pa = await A.c.from('profiles').select('*').eq('id', A.id).single();
  ok('perfil criado automaticamente', pa.data?.account_type === 'politico' && pa.data?.state === 'PE', pa.error?.message);
  // tentativa de se auto-verificar
  const v = await A.c.from('profiles').update({ verified: true }).eq('id', A.id).select();
  ok('não consegue se dar selo de verificado', !v.data?.length || v.data[0].verified === false, v.error?.message);
  const post = await A.c.from('posts').insert({ user_id: A.id, type: 'image', media_url: 'https://example.com/x.jpg', caption: 'Audiência pública' }).select().single();
  ok('publicar', !!post.data, post.error?.message);
  const fake = await B.c.from('posts').insert({ user_id: A.id, type: 'image', media_url: 'x', caption: 'falso' });
  ok('não publica em nome de outro', !!fake.error);
  ok('curtir', !(await B.c.from('likes').insert({ post_id: post.data.id, user_id: B.id })).error);
  const cm = await B.c.from('comments').insert({ post_id: post.data.id, user_id: B.id, text: `Ótimo! @caio_${tag}` });
  ok('comentar', !cm.error, cm.error?.message);
  const na = await A.c.from('notifications').select('type');
  ok('notificações de curtida e comentário', ['like', 'comment'].every(t => na.data?.some(n => n.type === t)), JSON.stringify(na.data));
  const nc = await Cc.c.from('notifications').select('type');
  ok('notificação de menção', nc.data?.some(n => n.type === 'mention'));
  const nb = await B.c.from('notifications').select('*').eq('to_user_id', A.id);
  ok('não vê notificação dos outros', (nb.data || []).length === 0);
  // seguir
  ok('seguir', !(await B.c.from('follows').insert({ follower_id: B.id, following_id: A.id })).error);
  // conta privada
  await Cc.c.from('profiles').update({ private_account: true }).eq('id', Cc.id);
  await Cc.c.from('posts').insert({ user_id: Cc.id, type: 'image', media_url: 'x', caption: 'privado' });
  const seePriv = await B.c.from('posts').select('id').eq('user_id', Cc.id);
  ok('conta privada esconde posts de quem não segue', (seePriv.data || []).length === 0);
  const fPriv = await B.c.from('follows').insert({ follower_id: B.id, following_id: Cc.id });
  ok('conta privada não deixa seguir direto', !!fPriv.error);
  ok('pedir para seguir', !(await B.c.from('follow_requests').insert({ from_id: B.id, to_id: Cc.id })).error);
  ok('aceitar pedido', !(await Cc.c.from('follows').insert({ follower_id: B.id, following_id: Cc.id })).error);
  const seePriv2 = await B.c.from('posts').select('id').eq('user_id', Cc.id);
  ok('depois de aceito vê os posts', (seePriv2.data || []).length === 1);
  // autorização ao político
  const cs = await B.c.from('consents').insert({ politician_id: A.id, user_id: B.id, fields: ['nome', 'cidade', 'faixaEtaria', 'email'], email: 'beto@example.com', interests: [] });
  ok('autorizar político', !cs.error, cs.error?.message);
  const sup = await A.c.rpc('my_supporters');
  ok('político vê apoiador só com campos autorizados', sup.data?.[0]?.city === 'Olinda' && sup.data?.[0]?.whatsapp === null && sup.data?.[0]?.age_range, JSON.stringify(sup.data?.[0]));
  const csC = await Cc.c.from('consents').insert({ politician_id: B.id, user_id: Cc.id, fields: ['nome'], interests: [] });
  ok('não autoriza conta que não é política', !!csC.error);
  const st = await A.c.rpc('audience_stats', { pid: A.id });
  ok('estatísticas anônimas do público', st.data?.followers === 1, JSON.stringify(st.data));
  // mensagens: B -> A
  const conv = await B.c.rpc('open_conversation', { other: A.id });
  ok('abrir conversa', !!conv.data, conv.error?.message);
  ok('enviar mensagem', !(await B.c.from('messages').insert({ conversation_id: conv.data, sender_id: B.id, text: 'Olá!' })).error);
  const spy = await Cc.c.from('messages').select('*').eq('conversation_id', conv.data);
  ok('terceiro não lê a conversa', (spy.data || []).length === 0);
  // batalha A x B (B segue A → B aceita desafios de quem ele segue)
  const bt = await A.c.from('battles').insert({ host_id: A.id, opponent_id: B.id, topic: 'Passe livre: vale o custo?', duration_sec: 180 }).select().single();
  ok('criar batalha', !!bt.data, bt.error?.message);
  ok('plateia apoia', !(await Cc.c.from('battle_events').insert({ battle_id: bt.data.id, user_id: Cc.id, kind: 'support', side: 'host', points: 20 })).error);
  const selfSup = await A.c.from('battle_events').insert({ battle_id: bt.data.id, user_id: A.id, kind: 'support', side: 'host', points: 100 });
  ok('debatedor não apoia a si mesmo', !!selfSup.error);
  const badPts = await Cc.c.from('battle_events').insert({ battle_id: bt.data.id, user_id: Cc.id, kind: 'support', side: 'host', points: 9999 });
  ok('não aceita pontos inventados', !!badPts.error);
  await A.c.from('battles').update({ score_host: 99999 }).eq('id', bt.data.id);
  const sc = await A.c.from('battles').select('score_host,score_opponent').eq('id', bt.data.id).single();
  ok('placar só muda pelos apoios (sem trapaça)', sc.data?.score_host === 20, JSON.stringify(sc.data));
  ok('chat da batalha', !(await B.c.from('battle_events').insert({ battle_id: bt.data.id, user_id: B.id, kind: 'chat', text: 'Boa noite!' })).error);
  const end = await A.c.from('battles').update({ status: 'ended' }).eq('id', bt.data.id).select('status').single();
  ok('quem abriu encerra a batalha', end.data?.status === 'ended', end.error?.message);
  // arquivo
  const up = await B.c.storage.from('media').upload(`${B.id}/teste.txt`, new Blob(['oi']), { contentType: 'text/plain' });
  ok('enviar arquivo na própria pasta', !up.error, up.error?.message);
  const upBad = await B.c.storage.from('media').upload(`${A.id}/hack.txt`, new Blob(['x']), { contentType: 'text/plain' });
  ok('não envia na pasta dos outros', !!upBad.error);
} catch (e) { out.push('ERRO ' + e.message); }
console.log(out.join('\n'));
console.log('TAG', tag);
