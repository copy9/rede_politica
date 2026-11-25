// Traduções. A chave é o próprio texto em português: t('Salvos') devolve 'Saved' em inglês.
// Texto sem tradução cadastrada aparece em português (nunca quebra a tela).
// Para traduzir mais telas: troque o texto fixo por t('...') e adicione a linha aqui.
import { createContext, useCallback } from 'react';

import { UI_EN, UI_ES, UI_PATTERNS } from './i18n-ui';

import { useSettings, type Language } from './settings';

type Dict = Record<string, string>;

const en: Dict = {
  'Autorizações da plataforma': 'Platform permissions',
  'Termos e Privacidade': 'Terms and Privacy',
  'Modo escuro': 'Dark mode',
  'Seguindo o celular. Mais opções em Aparência.': 'Following your phone. More options in Appearance.',
  // Configurações (página principal)
  Configurações: 'Settings',
  'Pesquisar nas configurações': 'Search settings',
  'Sua conta': 'Your account',
  'Editar perfil': 'Edit profile',
  'Informações pessoais': 'Personal information',
  'Senha e segurança': 'Password and security',
  'Verificação de conta oficial': 'Official account verification',
  'Conta política (ativa)': 'Political account (active)',
  'Sou político ou candidato': "I'm a politician or candidate",
  'Painel do político': 'Politician dashboard',
  'Como você usa o Polarizei': 'How you use Polarizei',
  Salvos: 'Saved',
  'Sua atividade': 'Your activity',
  Notificações: 'Notifications',
  'Tempo de uso': 'Time spent',
  'Quem pode ver seu conteúdo': 'Who can see your content',
  'Privacidade da conta': 'Account privacy',
  'Melhores amigos': 'Close friends',
  'Bloqueados e silenciados': 'Blocked and muted',
  'Minhas autorizações a políticos': 'My permissions to politicians',
  'Como outras pessoas podem interagir com você': 'How others can interact with you',
  Mensagens: 'Messages',
  Menções: 'Mentions',
  'Comentários e palavras ocultas': 'Comments and hidden words',
  'Desafios para batalhas': 'Battle challenges',
  'Seu app e mídia': 'Your app and media',
  'Aparência (modo escuro)': 'Appearance (dark mode)',
  'Uso de dados e mídia': 'Data usage and media',
  Idioma: 'Language',
  'Mais informações e suporte': 'More info and support',
  Ajuda: 'Help',
  'Termos de uso e privacidade': 'Terms and privacy',
  Sobre: 'About',
  Entrar: 'Log in',
  Sair: 'Log out',
  'Polarizei • versão de teste': 'Polarizei • test version',
  'E-mail': 'Email',
  Automático: 'Automatic',
  Claro: 'Light',
  Escuro: 'Dark',
  Pública: 'Public',
  Privada: 'Private',
  Pausadas: 'Paused',
  'Economia ligada': 'Data saver on',
  'Em análise': 'Under review',
  Todos: 'Everyone',
  'Pessoas que você segue': 'People you follow',
  Ninguém: 'No one',
  'min/dia': 'min/day',
  // Títulos das telas
  Publicação: 'Post',
  Comentários: 'Comments',
  Curtidas: 'Likes',
  'Editar perfil ': 'Edit profile',
  'Receber novidades': 'Get updates',
  'Minhas autorizações': 'My permissions',
  'Nova batalha': 'New battle',
  Aparência: 'Appearance',
  Verificação: 'Verification',
  'Página não encontrada': 'Page not found',
  // Login
  'Participe, debata, fiscalize.': 'Take part, debate, hold power to account.',
  'Nome de usuário ou e-mail': 'Username or email',
  Senha: 'Password',
  'Entrar com a conta de demonstração': 'Log in with the demo account',
  'Entrar como político (demonstração)': 'Log in as a politician (demo)',
  'Não tem uma conta?': "Don't have an account?",
  'Cadastre-se': 'Sign up',
  // Aparência e idioma
  Tema: 'Theme',
  'Igual ao celular': 'Same as your phone',
  'No automático, o app segue o modo claro/escuro configurado no seu celular.':
    "On automatic, the app follows your phone's light/dark setting.",
  'Economia de dados': 'Data saver',
  'Carrega fotos em qualidade menor e não toca vídeos sozinho no feed.': "Loads lower-quality photos and doesn't autoplay videos in the feed.",
  'Reproduzir vídeos automaticamente no feed': 'Autoplay videos in the feed',
  'As preferências ficam salvas neste celular.': 'Preferences are saved on this phone.',
  'Idioma do app': 'App language',
  'O app inteiro muda de idioma na hora. Publicações, comentários e nomes que as pessoas escrevem continuam como foram escritos.':
    'The whole app changes language right away. Posts, comments and names people write stay as they were written.',
};

const es: Dict = {
  'Autorizações da plataforma': 'Autorizaciones de la plataforma',
  'Termos e Privacidade': 'Términos y Privacidad',
  'Modo escuro': 'Modo oscuro',
  'Seguindo o celular. Mais opções em Aparência.': 'Siguiendo el teléfono. Más opciones en Apariencia.',
  Configurações: 'Configuración',
  'Pesquisar nas configurações': 'Buscar en la configuración',
  'Sua conta': 'Tu cuenta',
  'Editar perfil': 'Editar perfil',
  'Informações pessoais': 'Información personal',
  'Senha e segurança': 'Contraseña y seguridad',
  'Verificação de conta oficial': 'Verificación de cuenta oficial',
  'Conta política (ativa)': 'Cuenta política (activa)',
  'Sou político ou candidato': 'Soy político o candidato',
  'Painel do político': 'Panel del político',
  'Como você usa o Polarizei': 'Cómo usas Polarizei',
  Salvos: 'Guardados',
  'Sua atividade': 'Tu actividad',
  Notificações: 'Notificaciones',
  'Tempo de uso': 'Tiempo de uso',
  'Quem pode ver seu conteúdo': 'Quién puede ver tu contenido',
  'Privacidade da conta': 'Privacidad de la cuenta',
  'Melhores amigos': 'Mejores amigos',
  'Bloqueados e silenciados': 'Bloqueados y silenciados',
  'Minhas autorizações a políticos': 'Mis autorizaciones a políticos',
  'Como outras pessoas podem interagir com você': 'Cómo pueden interactuar contigo',
  Mensagens: 'Mensajes',
  Menções: 'Menciones',
  'Comentários e palavras ocultas': 'Comentarios y palabras ocultas',
  'Desafios para batalhas': 'Desafíos para batallas',
  'Seu app e mídia': 'Tu app y contenido multimedia',
  'Aparência (modo escuro)': 'Apariencia (modo oscuro)',
  'Uso de dados e mídia': 'Uso de datos y multimedia',
  Idioma: 'Idioma',
  'Mais informações e suporte': 'Más información y ayuda',
  Ajuda: 'Ayuda',
  'Termos de uso e privacidade': 'Términos y privacidad',
  Sobre: 'Acerca de',
  Entrar: 'Iniciar sesión',
  Sair: 'Cerrar sesión',
  'Polarizei • versão de teste': 'Polarizei • versión de prueba',
  'E-mail': 'Correo',
  Automático: 'Automático',
  Claro: 'Claro',
  Escuro: 'Oscuro',
  Pública: 'Pública',
  Privada: 'Privada',
  Pausadas: 'En pausa',
  'Economia ligada': 'Ahorro activado',
  'Em análise': 'En revisión',
  Todos: 'Todos',
  'Pessoas que você segue': 'Personas que sigues',
  Ninguém: 'Nadie',
  'min/dia': 'min/día',
  Publicação: 'Publicación',
  Comentários: 'Comentarios',
  Curtidas: 'Me gusta',
  'Receber novidades': 'Recibir novedades',
  'Minhas autorizações': 'Mis autorizaciones',
  'Nova batalha': 'Nueva batalla',
  Aparência: 'Apariencia',
  Verificação: 'Verificación',
  'Página não encontrada': 'Página no encontrada',
  'Participe, debata, fiscalize.': 'Participa, debate, fiscaliza.',
  'Nome de usuário ou e-mail': 'Usuario o correo',
  Senha: 'Contraseña',
  'Entrar com a conta de demonstração': 'Entrar con la cuenta de demostración',
  'Entrar como político (demonstração)': 'Entrar como político (demostración)',
  'Não tem uma conta?': '¿No tienes cuenta?',
  'Cadastre-se': 'Regístrate',
  Tema: 'Tema',
  'Igual ao celular': 'Igual que el teléfono',
  'No automático, o app segue o modo claro/escuro configurado no seu celular.':
    'En automático, la app sigue el modo claro/oscuro de tu teléfono.',
  'Economia de dados': 'Ahorro de datos',
  'Carrega fotos em qualidade menor e não toca vídeos sozinho no feed.':
    'Carga fotos con menor calidad y no reproduce videos solos en el feed.',
  'Reproduzir vídeos automaticamente no feed': 'Reproducir videos automáticamente en el feed',
  'As preferências ficam salvas neste celular.': 'Las preferencias se guardan en este teléfono.',
  'Idioma do app': 'Idioma de la app',
  'O app inteiro muda de idioma na hora. Publicações, comentários e nomes que as pessoas escrevem continuam como foram escritos.':
    'Toda la app cambia de idioma al instante. Las publicaciones, comentarios y nombres que escriben las personas quedan como fueron escritos.',
};

const DICTS: Record<Language, Dict> = { 'pt-BR': {}, en: { ...UI_EN, ...en }, es: { ...UI_ES, ...es } };

// textos com partes variáveis ("Você está seguindo {0}") viram expressões regulares
const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PATTERNS = UI_PATTERNS.map(([pt, enT, esT]) => {
  const parts = pt.split(/\{\d+\}/);
  const order = [...pt.matchAll(/\{(\d+)\}/g)].map((m) => Number(m[1]));
  return { re: new RegExp('^' + parts.map(esc).join('([\\s\\S]+?)') + '$'), order, en: enT, es: esT };
});

const cache: Record<Language, Map<string, string>> = { 'pt-BR': new Map(), en: new Map(), es: new Map() };

/** Traduz um texto da tela. Mantém espaços das pontas; tenta o texto exato e depois os modelos com partes variáveis. */
export function translate(text: string, lang: Language): string {
  if (lang === 'pt-BR' || !text) return text;
  const hit = cache[lang].get(text);
  if (hit !== undefined) return hit;
  const lead = text.match(/^\s*/)![0];
  const trail = text.slice(lead.length).match(/\s*$/)![0];
  const core = text.slice(lead.length, text.length - trail.length);
  let out = DICTS[lang][core];
  if (out === undefined && core.length < 400) {
    for (const p of PATTERNS) {
      const m = core.match(p.re);
      if (!m) continue;
      const vals = m.slice(1).map((v) => translate(v, lang));
      out = (lang === 'en' ? p.en : p.es).replace(/\{(\d+)\}/g, (_, n) => vals[p.order.indexOf(Number(n))] ?? '');
      break;
    }
  }
  const res = out === undefined ? text : lead + out + trail;
  if (cache[lang].size > 5000) cache[lang].clear();
  cache[lang].set(text, res);
  return res;
}

// ---------- idioma de toda a tela ----------
// Todos os textos do app passam por components/i18n-native (Text e TextInput), que leem este contexto.
export const UILanguageContext = createContext<Language>('pt-BR');
let uiLanguage: Language = 'pt-BR';
export function setUILanguage(lang: Language) {
  uiLanguage = lang;
}
/** Para textos fora da tela (alertas do sistema, mensagens de compartilhar). */
export function tr(text: string) {
  return translate(text, uiLanguage);
}

/** const t = useT();  t('Salvos') */
export function useT() {
  const lang = useSettings().settings.language;
  return useCallback((text: string) => translate(text, lang), [lang]);
}
