// Teste completo do app no navegador (3 contas). Rodar com o app web aberto em localhost:8081:
//   node scripts/testar-app.js <pasta-para-prints> <imagem.png>
// Teste completo: 3 contas (Ana política, Bruno e Carla cidadãos) usando todas as funções.
const { chromium } = require('playwright');
const crypto = require('crypto');
const out = process.argv[2], img = process.argv[3];
const tag = Math.random().toString(36).slice(2, 7);
const res = [];
const wait = (p, ms = 1200) => p.waitForTimeout(ms);
const body = (p) => p.innerText('body');
const go = (p, path) => p.evaluate((path) => { window.history.pushState({}, '', path); window.dispatchEvent(new PopStateEvent('popstate')); }, path);
async function until(p, fn, ms = 15000) { const t = Date.now(); while (Date.now() - t < ms) { try { if (await fn()) return true; } catch {} await p.waitForTimeout(500); } return false; }
async function step(name, fn) {
  try { const r = await fn(); res.push(`${r === false ? 'FAIL' : 'PASS'}  ${name}`); }
  catch (e) { res.push(`FAIL  ${name} — ${e.message.split('\n')[0].slice(0, 160)}`); }
  console.log(res[res.length - 1]);
}
function totp(secret) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = '';
  for (const c of secret.replace(/=+$/, '')) bits += alphabet.indexOf(c).toString(2).padStart(5, '0');
  const key = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = crypto.createHmac('sha1', key).update(counter).digest(); const o = h[h.length - 1] & 15;
  return String(((h.readUInt32BE(o) & 0x7fffffff) % 1e6)).padStart(6, '0');
}
async function newPage(b) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage(); p.errors = [];
  p.on('pageerror', (e) => { if (!/no supported source|play\(\)/.test(e.message)) p.errors.push(e.message); });
  return p;
}
async function signup(p, { name, user, politico, city }) {
  await p.goto('http://localhost:8081/signup', { waitUntil: 'networkidle' }); await wait(p, 1500);
  if (politico) await p.getByText('Político / candidato', { exact: true }).click();
  await p.getByPlaceholder('E-mail').fill(`${user}@example.com`);
  await p.getByPlaceholder('Nome completo').fill(name);
  await p.getByPlaceholder('Nome de usuário').fill(user);
  await p.getByPlaceholder('Senha (mín. 6 caracteres)').fill('segredo123');
  await p.getByPlaceholder('Data de nascimento (DD/MM/AAAA)').fill('15061990');
  if (politico) await p.getByPlaceholder(/Cargo ou pretensão/).fill('Vereadora');
  await p.getByPlaceholder(politico ? 'Cidade' : 'Cidade (opcional)').fill(city);
  await p.getByPlaceholder('UF').fill('PE');
  await p.getByText(/^Tenho 18 anos ou mais/).click();
  await p.getByText('Cadastrar', { exact: true }).click();
  return until(p, async () => { const t = await body(p); return !t.includes('Cadastrar') && !t.includes('Criando conta'); }, 30000);
}
async function login(p, email, pass) {
  await p.goto('http://localhost:8081/login', { waitUntil: 'networkidle' }); await wait(p, 1500);
  await p.getByPlaceholder('E-mail').fill(email);
  await p.getByPlaceholder('Senha').fill(pass);
  await p.getByText('Entrar', { exact: true }).first().click();
}
async function pickFile(p, clickText) {
  const [fc] = await Promise.all([p.waitForEvent('filechooser', { timeout: 10000 }), p.getByText(clickText, { exact: true }).first().click()]);
  await fc.setFiles(img);
}
const A_ = `ana_${tag}`, B_ = `bruno_${tag}`, C_ = `carla_${tag}`;

(async () => {
  const b = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } });
  const A = await newPage(b), B = await newPage(b), C = await newPage(b);

  await step('cadastro: Ana (política)', () => signup(A, { name: 'Ana Teste', user: A_, politico: true, city: 'Recife' }));
  await step('cadastro: Bruno', () => signup(B, { name: 'Bruno Teste', user: B_, city: 'Olinda' }));
  await step('cadastro: Carla', () => signup(C, { name: 'Carla Teste', user: C_, city: 'Recife' }));
  for (const p of [A, B, C]) { await p.reload({ waitUntil: 'networkidle' }); }
  await wait(A, 3000);

  // ---------- publicação ----------
  await step('Bruno publica foto com legenda', async () => {
    await go(B, '/create'); await wait(B, 1200);
    await pickFile(B, 'Escolher da galeria'); await wait(B, 1500);
    await B.getByPlaceholder('Escreva uma legenda...').fill(`Obra parada ${tag} @${A_}`);
    await B.getByText('Compartilhar').last().click();
    return until(B, async () => (await body(B)).includes(`Obra parada ${tag}`), 20000);
  });
  await step('Ana recebe notificação de menção', async () => { await go(A, '/notifications'); return until(A, async () => (await body(A)).includes('mencionou você'), 20000); });

  await step('Ana vê o post do Bruno no feed', async () => { await A.reload({ waitUntil: 'networkidle' }); await wait(A, 2500); await go(A, '/'); await wait(A, 1500); return (await body(A)).includes(`Obra parada ${tag}`); });
  let postPath = null;
  await step('curtir e salvar o post', async () => {
    await go(A, `/user/${B_}`); await wait(A, 2000);
    await A.locator('img').last().click();
    await until(A, async () => A.url().includes('/post/'));
    postPath = new URL(A.url()).pathname;
    if (!postPath.startsWith('/post/')) return false;
    await A.getByLabel('Curtir').first().click(); await wait(A, 600);
    await A.getByLabel('Salvar').first().click(); await wait(A, 1500);
    await go(A, '/salvos'); await wait(A, 1500);
    const saved = (await A.locator('img').count()) > 0;
    await go(A, postPath); await wait(A, 1200);
    return saved;
  });
  await step('página do post abre', async () => postPath && (await body(A)).includes(`Obra parada ${tag}`));
  await step('comentar no post', async () => {
    await go(A, postPath.replace('/post/', '/comments/')); await wait(A, 1500);
    await A.getByPlaceholder(/Adicione um comentário|Comente como/).fill(`Precisa de fiscalização ${tag}`);
    await A.getByText('Publicar', { exact: true }).click(); await wait(A, 1500);
    return (await body(A)).includes(`Precisa de fiscalização ${tag}`);
  });
  await step('Bruno recebe notificações de curtida e comentário', async () => { await go(B, '/notifications'); return until(B, async () => (await body(B)).includes('comentou') && (await body(B)).includes('curtiu'), 20000); });

  // ---------- seguir / conta privada / pedidos ----------
  await step('Carla deixa a conta privada', async () => {
    await go(C, '/config/privacidade'); await wait(C, 1200);
    await C.getByRole('switch').first().click(); await wait(C, 2500); return true;
  });
  await step('Ana pede para seguir a Carla (conta privada)', async () => {
    await A.reload({ waitUntil: 'networkidle' }); await wait(A, 3000);
    await go(A, `/user/${C_}`); await wait(A, 1500);
    const lock = (await body(A)).includes('Esta conta é privada');
    await A.getByText('Seguir', { exact: true }).first().click(); await wait(A, 1500);
    return lock && (await body(A)).includes('Solicitado');
  });
  await step('Carla aceita o pedido', async () => {
    await go(C, '/notifications');
    const ok = await until(C, async () => (await body(C)).includes('Pedidos para seguir'), 20000);
    await C.getByText('Aceitar', { exact: true }).first().click();
    await wait(C, 2000); return ok;
  });
  await step('Ana passa a seguir a Carla', async () => { await A.reload({ waitUntil: 'networkidle' }); await wait(A, 3000); await go(A, `/user/${C_}`); await wait(A, 1500); return (await body(A)).includes('Seguindo') && !(await body(A)).includes('Esta conta é privada'); });
  await step('Bruno e Carla seguem a Ana', async () => {
    for (const p of [B, C]) { await go(p, `/user/${A_}`); await wait(p, 1500); await p.getByText('Seguir', { exact: true }).first().click(); await wait(p, 1500); }
    return true;
  });

  // ---------- autorização a político / painel ----------
  await step('Bruno autoriza a Ana (Quero receber novidades)', async () => {
    await go(B, `/user/${A_}`); await wait(B, 1200);
    await B.getByText('Quero receber novidades').click(); await wait(B, 2000);
    return (await body(B)).includes('Você recebe novidades');
  });
  await step('painel da Ana mostra seguidores e apoiador reais', async () => {
    await A.reload({ waitUntil: 'networkidle' }); await wait(A, 3000); await go(A, '/painel'); await wait(A, 2000);
    const t = await body(A); return /Seguidores\s*2\b/.test(t) && /Apoiadores cadastrad[^\n]*\n?\s*1\b/.test(t);
  });
  await step('Bruno cancela a autorização', async () => {
    await go(B, '/autorizacoes'); await wait(B, 1500);
    await B.getByText('Cancelar', { exact: true }).first().click(); await wait(B, 600);
    await B.getByText('Cancelar autorização', { exact: true }).last().click(); await wait(B, 2000);
    return !(await body(B)).includes('Ana Teste');
  });

  // ---------- mensagens ----------
  await step('mensagem direta Bruno → Ana', async () => {
    await go(B, `/user/${A_}`); await wait(B, 1500);
    await B.getByText('Mensagem', { exact: true }).click();
    await until(B, async () => B.url().includes('/messages/'));
    await B.getByPlaceholder('Mensagem...').fill(`Oi Ana ${tag}`); await B.getByLabel('Enviar').click(); await wait(B, 1500);
    await go(A, new URL(B.url()).pathname);
    return until(A, async () => (await body(A)).includes(`Oi Ana ${tag}`), 20000);
  });

  // ---------- story ----------
  await step('Bruno posta story', async () => {
    await go(B, '/'); await wait(B, 1500);
    await pickFile(B, 'Seu story'); await wait(B, 1000);
    await B.getByText('Todos', { exact: true }).last().click(); await wait(B, 4000);
    return true;
  });
  await step('Ana vê o story do Bruno', async () => {
    await A.reload({ waitUntil: 'networkidle' }); await wait(A, 3000); await go(A, '/'); await wait(A, 1500);
    return (await body(A)).includes(B_);
  });

  // ---------- batalha ----------
  let battlePath = null;
  await step('Ana desafia a Carla pelo botão Desafiar', async () => {
    await go(A, `/user/${C_}`); await wait(A, 1500);
    await A.getByText('Desafiar', { exact: true }).click(); await wait(A, 1500);
    await A.getByPlaceholder(/Passe livre/).fill(`Debate ${tag}`);
    await A.getByText('Começar batalha ao vivo').click();
    await until(A, async () => A.url().includes('/battle/') && !A.url().includes('/new'));
    battlePath = new URL(A.url()).pathname; return !!battlePath;
  });
  await step('Carla recebe notificação do desafio e abre a sala', async () => {
    await go(C, '/notifications');
    const ok = await until(C, async () => (await body(C)).includes('te desafiou'), 20000);
    await C.getByText(/te desafiou/).first().click(); await wait(C, 2000);
    return ok && C.url().includes(battlePath);
  });
  await step('plateia: apoio +20, curtidas e chat chegam para todos', async () => {
    await go(B, battlePath); await until(B, async () => (await body(B)).includes(`Debate ${tag}`));
    await B.getByText('Ana', { exact: true }).last().click(); await wait(B, 500);
    await B.getByText('+20', { exact: true }).click();
    for (let i = 0; i < 3; i++) await B.getByLabel('Curtir').click();
    await B.getByPlaceholder('Comente...').fill(`Boa ${tag}`); await B.getByPlaceholder('Comente...').press('Enter');
    const s = await until(C, async () => (await body(C)).includes('20'), 15000);
    const l = await until(A, async () => (await A.getByLabel('Curtir').innerText()).includes('3'), 15000);
    const m = await until(A, async () => (await body(A)).includes(`Boa ${tag}`), 15000);
    return s && l && m;
  });
  await step('Ana encerra a batalha e todos veem o resultado', async () => {
    await A.getByText('Encerrar', { exact: true }).click(); await wait(A, 600);
    await A.getByText('Encerrar', { exact: true }).last().click(); await wait(A, 2500);
    return until(B, async () => /Vitória|Empate/.test(await body(B)), 15000);
  });
  await step('batalha agendada + Lembrar-me + começar → Bruno recebe "começou"', async () => {
    await go(A, '/battle/new'); await wait(A, 1500);
    await A.getByPlaceholder(/Passe livre/).fill(`Agendada ${tag}`);
    await A.getByText('Em 1 hora', { exact: true }).click();
    await A.getByPlaceholder('Pesquisar pessoa').fill('carla'); await wait(A, 800);
    await A.getByText(C_).first().click();
    await A.getByText('Agendar batalha').click();
    await until(A, async () => A.url().includes('/battle/') && !A.url().includes('/new'));
    const path = new URL(A.url()).pathname;
    await B.reload({ waitUntil: 'networkidle' }); await wait(B, 3000);
    await go(B, path); await until(B, async () => (await body(B)).includes('Lembrar-me'));
    await B.getByText('Lembrar-me').click(); await wait(B, 1500);
    await A.getByText('Começar agora').click(); await wait(A, 2000);
    await go(B, '/notifications');
    return until(B, async () => (await body(B)).includes('começou a batalha'), 20000);
  });

  // ---------- denúncia, verificação, configurações ----------
  await step('denunciar perfil (grava no banco)', async () => {
    await go(B, `/user/${C_}`); await wait(B, 1500);
    await B.getByLabel('Mais opções').click(); await wait(B, 600);
    await B.getByText('Denunciar perfil').click(); await wait(B, 600);
    await B.getByText('Conta falsa').click(); await wait(B, 1500);
    return (await body(B)).includes('denúncia foi enviada');
  });
  await step('pedido de verificação (Ana)', async () => {
    await go(A, '/config/verificacao'); await wait(A, 1200);
    await A.getByPlaceholder('CPF ou número da candidatura').fill('12345678900');
    await A.getByText('Enviar pedido').click(); await wait(A, 1500);
    return (await body(A)).includes('enviado');
  });
  await step('editar perfil (bio) e continua depois de recarregar', async () => {
    await go(C, '/edit-profile'); await wait(C, 1200);
    const bio = C.locator('textarea').first();
    await bio.fill(`Professora ${tag}`);
    await C.getByText('Concluir').click(); await wait(C, 2000);
    await C.reload({ waitUntil: 'networkidle' }); await wait(C, 3000);
    await go(C, '/profile'); await wait(C, 1500);
    return (await body(C)).includes(`Professora ${tag}`);
  });
  await step('bloquear e desbloquear', async () => {
    await go(B, `/user/${C_}`); await wait(B, 1200);
    await B.getByLabel('Mais opções').click(); await wait(B, 600);
    await B.getByText(/^Bloquear/).first().click(); await wait(B, 600);
    await B.getByText(/^Bloquear/).last().click().catch(() => {}); await wait(B, 2000);
    await go(B, '/config/bloqueados'); await wait(B, 1500);
    const listed = (await body(B)).includes(C_);
    await B.getByText('Desbloquear').first().click(); await wait(B, 1500);
    return listed;
  });

  // ---------- senha, dois fatores, aparelhos ----------
  await step('trocar senha e entrar com a nova', async () => {
    await go(C, '/config/seguranca'); await wait(C, 1500);
    await C.getByPlaceholder('Senha atual').fill('segredo123');
    await C.getByPlaceholder(/Nova senha/).fill('novaSenha123');
    await C.getByPlaceholder('Repita a nova senha').fill('novaSenha123');
    await C.getByText('Alterar senha', { exact: true }).last().click(); await wait(C, 3000);
    const ok = (await body(C)).includes('Senha alterada');
    await C.evaluate(() => localStorage.clear());
    await login(C, `${C_}@example.com`, 'novaSenha123');
    return ok && await until(C, async () => !(await body(C)).includes('Não tem uma conta'), 20000);
  });
  let secret = null;
  await step('ligar dois fatores (app autenticador)', async () => {
    await go(C, '/config/seguranca'); await wait(C, 2000);
    await C.getByRole('switch').first().click(); await wait(C, 2500);
    secret = (await body(C)).match(/\b[A-Z2-7]{26,}\b/)?.[0];
    if (!secret) return false;
    await C.getByPlaceholder('000000').fill(totp(secret));
    await C.getByText('Confirmar e ligar').click(); await wait(C, 2500);
    return (await body(C)).includes('Dois fatores ligado');
  });
  await step('login pede o código e entra com ele', async () => {
    await C.evaluate(() => localStorage.clear());
    await login(C, `${C_}@example.com`, 'novaSenha123');
    const asked = await until(C, async () => (await body(C)).includes('app autenticador'), 20000);
    await C.getByPlaceholder('Código de 6 dígitos').fill(totp(secret));
    await C.getByText('Confirmar', { exact: true }).click();
    return asked && await until(C, async () => !(await body(C)).includes('Confirme que é você'), 20000);
  });
  await step('alerta de login aparece nas notificações', async () => { await go(C, '/notifications'); return until(C, async () => (await body(C)).includes('Novo acesso'), 15000); });
  await step('aparelhos conectados aparecem', async () => { await go(C, '/config/seguranca'); await wait(C, 2000); return (await body(C)).includes('este aparelho'); });
  await step('desligar dois fatores', async () => {
    await C.getByRole('switch').first().click(); await wait(C, 600);
    await C.getByText('Desligar', { exact: true }).last().click(); await wait(C, 2500);
    return (await body(C)).includes('Dois fatores desligado');
  });

  // ---------- sair / entrar / excluir ----------
  await step('sair e entrar de novo (Bruno)', async () => {
    await go(B, '/settings'); await wait(B, 1200);
    await B.getByText('Sair', { exact: true }).last().click(); await wait(B, 800);
    if ((await body(B)).includes('Sair')) await B.getByText('Sair', { exact: true }).last().click().catch(() => {});
    await until(B, async () => (await body(B)).includes('Não tem uma conta'), 15000);
    await login(B, `${B_}@example.com`, 'segredo123');
    return until(B, async () => !(await body(B)).includes('Não tem uma conta'), 20000);
  });
  await step('excluir conta (Carla)', async () => {
    await go(C, '/config/dados-pessoais'); await wait(C, 1200);
    await C.getByText('Excluir minha conta').click(); await wait(C, 600);
    await C.getByText('Excluir conta definitivamente').click();
    return until(C, async () => (await body(C)).includes('Não tem uma conta'), 20000);
  });

  for (const [n, p] of [['Ana', A], ['Bruno', B], ['Carla', C]]) await step(`sem erros de código na tela (${n})`, async () => { if (p.errors.length) throw new Error(p.errors.join(' | ')); return true; });
  for (const [n, p] of [['ana', A], ['bruno', B]]) await p.screenshot({ path: `${out}/full-${n}.png` }).catch(() => {});
  console.log('\n' + res.filter((r) => r.startsWith('PASS')).length + ' PASS / ' + res.filter((r) => r.startsWith('FAIL')).length + ' FAIL');
  console.log('TAG', tag);
  await b.close();
})();
