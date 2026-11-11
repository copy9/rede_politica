import { InfoText, RadioGroup, Section, SettingsScreen, ToggleRow } from '@/components/SettingsUI';
import { useSettings } from '@/lib/settings';

export default function AppearanceScreen() {
  const { settings, update } = useSettings();
  return (
    <SettingsScreen>
      <Section title="Tema" footer="No automático, o app segue o modo claro/escuro configurado no seu celular.">
        <RadioGroup
          value={settings.themeMode}
          onChange={(themeMode) => update({ themeMode })}
          options={[
            { value: 'system', label: 'Automático', description: 'Igual ao celular', icon: 'phone-portrait-outline' },
            { value: 'light', label: 'Claro', icon: 'sunny-outline' },
            { value: 'dark', label: 'Escuro', icon: 'moon-outline' },
          ]}
        />
      </Section>
      <Section title="Uso de dados e mídia">
        <ToggleRow
          icon="cellular-outline"
          label="Economia de dados"
          description="Carrega fotos em qualidade menor e não toca vídeos sozinho no feed."
          value={settings.dataSaver}
          onChange={(dataSaver) => update({ dataSaver, autoplayVideos: dataSaver ? false : settings.autoplayVideos })}
        />
        <ToggleRow
          icon="play-circle-outline"
          label="Reproduzir vídeos automaticamente no feed"
          value={settings.autoplayVideos && !settings.dataSaver}
          disabled={settings.dataSaver}
          onChange={(autoplayVideos) => update({ autoplayVideos })}
        />
      </Section>
      <InfoText>As preferências ficam salvas neste celular.</InfoText>
    </SettingsScreen>
  );
}
