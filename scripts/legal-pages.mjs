// Gera as páginas públicas que as lojas pedem (Play Store e App Store):
//   docs/privacidade.html   -> link da Política de Privacidade
//   docs/excluir-conta.html -> link para pedir a exclusão da conta
// Usa os MESMOS textos do app (lib/legal.ts). Rodar: node scripts/legal-pages.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import ts from 'typescript';

const js = ts.transpileModule(readFileSync('lib/legal.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const mod = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
const { PRIVACY, TERMS, LEGAL_CONTACT: c } = mod;

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const page = (title, body) => `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · Splitter</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:760px;margin:0 auto;padding:32px 20px 64px;color:#0f172a;line-height:1.6}
  h1{font-size:28px;margin:0 0 4px} h2{font-size:18px;margin:28px 0 6px} .muted{color:#64748b}
  .brand{font-weight:800;font-size:20px;margin-bottom:24px} 
  .box{background:#f4f6fa;border-radius:12px;padding:16px 18px;margin:16px 0} a{color:#037EF6}
</style></head><body>
<div class="brand"><i>Splitter</i><div style="height:4px;width:120px;margin-top:4px;background:linear-gradient(90deg,#F5091F 50%,#037EF6 50%);border-radius:2px"></div></div>
${body}
</body></html>`;

mkdirSync('docs', { recursive: true });
writeFileSync(
  'docs/privacidade.html',
  page(
    'Política de Privacidade',
    `<h1>Política de Privacidade</h1><p class="muted">Última atualização: ${esc(c.updatedAt)}</p>
${PRIVACY.map(([t, b]) => `<h2>${esc(t)}</h2><p>${esc(b)}</p>`).join('\n')}
<h2>Termos de uso</h2>
${TERMS.map(([t, b]) => `<p><b>${esc(t)}.</b> ${esc(b)}</p>`).join('\n')}`,
  ),
);
writeFileSync(
  'docs/excluir-conta.html',
  page(
    'Excluir sua conta',
    `<h1>Excluir sua conta do Splitter</h1>
<div class="box"><b>Pelo app:</b> abra o Splitter › Configurações › <b>Excluir minha conta</b> › confirme. A conta é apagada na hora.</div>
<div class="box"><b>Sem acesso ao app:</b> envie um e-mail para <a href="mailto:${esc(c.email)}?subject=Excluir%20minha%20conta">${esc(c.email)}</a>
a partir do e-mail cadastrado, com o assunto <b>"Excluir minha conta"</b> e seu nome de usuário. Excluímos em até 15 dias e confirmamos por e-mail.</div>
<h2>O que é apagado</h2>
<p>Seu perfil, publicações, stories, comentários, mensagens, curtidas, seguidores, autorizações dadas a políticos, estatísticas e créditos de impulsionamento.</p>
<h2>O que pode ser mantido por um tempo</h2>
<p>Cópias de segurança são apagadas automaticamente em até 30 dias. Registros de acesso podem ser mantidos por 6 meses (Marco Civil da Internet) e registros de pagamento pelo prazo exigido pela lei fiscal.</p>
<p class="muted">${esc(c.company)} · CNPJ ${esc(c.cnpj)} · <a href="privacidade.html">Política de Privacidade</a></p>`,
  ),
);
writeFileSync('docs/index.html', page('Splitter', `<h1>Splitter</h1><p><a href="privacidade.html">Política de Privacidade</a> · <a href="excluir-conta.html">Excluir sua conta</a></p>`));
console.log('páginas geradas em docs/');
