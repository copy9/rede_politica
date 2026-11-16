// Aviso na tela quando chega uma mensagem direta nova (fora da conversa aberta).
import { usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useOverlay } from '@/components/Overlay';
import { useApp } from '@/lib/store';

export function MessageAlert() {
  const { me, messages, getUser } = useApp();
  const { showBanner } = useOverlay();
  const path = usePathname();
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!me) return;
    // primeira carga: só guarda o que já existia
    if (!seen.current) {
      seen.current = new Set(messages.map((m) => m.id));
      return;
    }
    const fresh = messages.filter((m) => !seen.current!.has(m.id));
    fresh.forEach((m) => seen.current!.add(m.id));
    const incoming = fresh.filter((m) => m.senderId !== me.id && !path.includes(m.conversationId));
    const last = incoming[incoming.length - 1];
    if (last) {
      const from = getUser(last.senderId);
      showBanner(`${from?.name ?? 'Nova mensagem'}: ${last.text.slice(0, 80)}`, { icon: 'chatbubble-ellipses-outline', tone: 'success' });
    }
  }, [messages, me, path, getUser, showBanner]);

  return null;
}
