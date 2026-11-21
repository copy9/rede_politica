// Registra visualizações e compartilhamentos para o Painel do político (tabela content_views).
// Visualização conta 1 vez por conteúdo enquanto o app está aberto; compartilhar conta sempre.
import { supabase } from './supabase';

export type ViewKind = 'post' | 'video' | 'story' | 'battle' | 'profile' | 'share';

const counted = new Set<string>();
let myId: string | null = null;
supabase.auth.getSession().then(({ data }) => (myId = data.session?.user.id ?? null));
supabase.auth.onAuthStateChange((_e, session) => (myId = session?.user.id ?? null));

export function recordView(ownerId: string | undefined, kind: ViewKind, refId?: string) {
  if (!ownerId || !myId || ownerId === myId) return;
  const key = `${kind}:${ownerId}:${refId ?? ''}`;
  if (kind !== 'share') {
    if (counted.has(key)) return;
    counted.add(key);
  }
  supabase
    .from('content_views')
    .insert({ owner_id: ownerId, viewer_id: myId, kind, ref_id: refId ?? null })
    .then(() => {});
}
