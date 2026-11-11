// Conta o tempo de uso (minutos com o app aberto) e aplica o limite diário e o lembrete de pausa.
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { dayKey, useSettings } from '@/lib/settings';
import { useApp } from '@/lib/store';
import { useOverlay } from './Overlay';

export function UsageTracker() {
  const { me } = useApp();
  const { accountSettings, updateAccount } = useSettings();
  const { showBanner } = useOverlay();
  const sessionMin = useRef(0);
  const warnedDay = useRef<string | null>(null);
  const active = useRef(AppState.currentState === 'active');
  const latest = useRef({ accountSettings, updateAccount, showBanner });
  latest.current = { accountSettings, updateAccount, showBanner };

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      active.current = state === 'active';
      // voltou depois de um tempo fora: começa uma nova sessão
      if (state !== 'active') sessionMin.current = 0;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!me) return;
    sessionMin.current = 0;
    const id = me.id;
    const t = setInterval(() => {
      if (!active.current) return;
      const { accountSettings: get, updateAccount: save, showBanner: banner } = latest.current;
      const acct = get(id);
      const today = dayKey();
      const minutes = (acct.usage[today] ?? 0) + 1;
      // guarda só os últimos 14 dias
      const keep = Object.keys(acct.usage).sort().slice(-13);
      const usage: Record<string, number> = {};
      keep.forEach((k) => (usage[k] = acct.usage[k]));
      usage[today] = minutes;
      save(id, { usage });

      sessionMin.current += 1;
      if (acct.dailyLimitMin && minutes >= acct.dailyLimitMin && warnedDay.current !== today) {
        warnedDay.current = today;
        banner(`Você atingiu seu limite diário de ${acct.dailyLimitMin} minutos. Que tal fazer uma pausa?`, {
          icon: 'hourglass-outline',
          tone: 'warning',
          durationMs: 8000,
        });
      } else if (acct.breakReminderMin && sessionMin.current % acct.breakReminderMin === 0) {
        banner(`Você está há ${sessionMin.current} minutos no app. Hora de uma pausa?`, {
          icon: 'cafe-outline',
          tone: 'info',
          durationMs: 6000,
        });
      }
    }, 60 * 1000);
    return () => clearInterval(t);
  }, [me]);

  return null;
}
