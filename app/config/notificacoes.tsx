import { Section, SettingsScreen, ToggleRow } from '@/components/SettingsUI';
import { useSettings } from '@/lib/settings';

export default function NotificationsSettingsScreen() {
  const { settings, updateNotifications } = useSettings();
  const n = settings.notifications;
  const off = n.pauseAll;
  return (
    <SettingsScreen>
      <Section footer="Pausar silencia todas as notificações até você ligar de novo.">
        <ToggleRow icon="notifications-off-outline" label="Pausar todas" value={n.pauseAll} onChange={(pauseAll) => updateNotifications({ pauseAll })} />
      </Section>
      <Section title="Publicações e comentários">
        <ToggleRow icon="heart-outline" label="Curtidas" value={n.likes} disabled={off} onChange={(likes) => updateNotifications({ likes })} />
        <ToggleRow icon="chatbubble-outline" label="Comentários" value={n.comments} disabled={off} onChange={(comments) => updateNotifications({ comments })} />
        <ToggleRow icon="at-outline" label="Menções" value={n.mentions} disabled={off} onChange={(mentions) => updateNotifications({ mentions })} />
      </Section>
      <Section title="Seguidores e mensagens">
        <ToggleRow icon="person-add-outline" label="Novos seguidores" value={n.follows} disabled={off} onChange={(follows) => updateNotifications({ follows })} />
        <ToggleRow icon="paper-plane-outline" label="Mensagens" value={n.messages} disabled={off} onChange={(messages) => updateNotifications({ messages })} />
      </Section>
      <Section title="Política e ao vivo">
        <ToggleRow
          icon="flash-outline"
          label="Batalhas ao vivo"
          description="Quando alguém que você segue começa ou agenda uma batalha"
          value={n.battles}
          disabled={off}
          onChange={(battles) => updateNotifications({ battles })}
        />
        <ToggleRow
          icon="megaphone-outline"
          label="Novidades de políticos autorizados"
          description="Comunicados dos políticos de quem você aceitou receber novidades"
          value={n.politicians}
          disabled={off}
          onChange={(politicians) => updateNotifications({ politicians })}
        />
      </Section>
    </SettingsScreen>
  );
}
