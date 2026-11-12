// Denunciar publicação, perfil ou batalha: escolhe o motivo e grava no banco para a equipe analisar.
import { useCallback } from 'react';

import { useApp, type ReportTarget } from '@/lib/store';
import { useOverlay } from './Overlay';

const REASONS = ['Desinformação / notícia falsa', 'Discurso de ódio ou ofensa', 'Ameaça ou violência', 'Spam ou golpe', 'Conta falsa', 'Outro motivo'];

export function useReport() {
  const { report } = useApp();
  const { showSheet, showBanner } = useOverlay();
  return useCallback(
    (targetType: ReportTarget, targetId: string, what: string) =>
      showSheet({
        title: `Denunciar ${what}`,
        message: 'Por que você está denunciando? A equipe analisa e quem foi denunciado não fica sabendo quem denunciou.',
        options: REASONS.map((reason) => ({
          label: reason,
          onPress: async () => {
            const err = await report(targetType, targetId, reason);
            showBanner(err ?? 'Obrigado. Sua denúncia foi enviada para análise.', { icon: 'flag-outline', tone: err ? 'warning' : 'success' });
          },
        })),
      }),
    [report, showSheet, showBanner],
  );
}
