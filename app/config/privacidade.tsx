import { useState } from 'react';

import { AUDIENCE_OPTIONS, NavRow, RadioGroup, Section, SettingsScreen, ToggleRow, audienceLabel } from '@/components/SettingsUI';
import { useSettings, type Audience } from '@/lib/settings';

type Key = 'whoCanComment' | 'whoCanMessage' | 'whoCanMention' | 'whoCanChallenge';

const TITLES: Record<Key, string> = {
  whoCanComment: 'Quem pode comentar',
  whoCanMessage: 'Quem pode enviar mensagens',
  whoCanMention: 'Quem pode mencionar você',
  whoCanChallenge: 'Quem pode desafiar você para batalhas',
};

export default function PrivacyScreen() {
  const { settings, update } = useSettings();
  const [open, setOpen] = useState<Key | null>(null);

  return (
    <SettingsScreen>
      <Section footer="Com a conta privada, só seguidores aprovados por você veem suas publicações. Contas políticas costumam ser públicas.">
        <ToggleRow icon="lock-closed-outline" label="Conta privada" value={settings.privateAccount} onChange={(privateAccount) => update({ privateAccount })} />
      </Section>
      <Section>
        <ToggleRow
          icon="radio-button-on-outline"
          label="Mostrar status de atividade"
          description="Quem você segue vê quando você esteve ativo por último"
          value={settings.showActivityStatus}
          onChange={(showActivityStatus) => update({ showActivityStatus })}
        />
        <ToggleRow
          icon="heart-dislike-outline"
          label="Ocultar número de curtidas"
          description="Você não verá o total de curtidas nas publicações"
          value={settings.hideLikeCounts}
          onChange={(hideLikeCounts) => update({ hideLikeCounts })}
        />
      </Section>
      <Section title="Interações">
        {(Object.keys(TITLES) as Key[]).map((key) => (
          <NavRow key={key} label={TITLES[key]} value={audienceLabel(settings[key])} onPress={() => setOpen(open === key ? null : key)} />
        ))}
      </Section>
      {open ? (
        <Section title={TITLES[open]}>
          <RadioGroup<Audience> value={settings[open]} onChange={(v) => update({ [open]: v } as Partial<typeof settings>)} options={AUDIENCE_OPTIONS} />
        </Section>
      ) : null}
    </SettingsScreen>
  );
}
