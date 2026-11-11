import { InfoText, RadioGroup, Section, SettingsScreen, ToggleRow } from '@/components/SettingsUI';
import { useT } from '@/lib/i18n';
import { useSettings } from '@/lib/settings';

export default function AppearanceScreen() {
  const { settings, update } = useSettings();
  const t = useT();
  return (
    <SettingsScreen>
      <Section title={t('Tema')} footer={t('No automático, o app segue o modo claro/escuro configurado no seu celular.')}>
        <RadioGroup
          value={settings.themeMode}
          onChange={(themeMode) => update({ themeMode })}
          options={[
            { value: 'system', label: t('Automático'), description: t('Igual ao celular'), icon: 'phone-portrait-outline' },
            { value: 'light', label: t('Claro'), icon: 'sunny-outline' },
            { value: 'dark', label: t('Escuro'), icon: 'moon-outline' },
          ]}
        />
      </Section>
      <Section title={t('Uso de dados e mídia')}>
        <ToggleRow
          icon="cellular-outline"
          label={t('Economia de dados')}
          description={t('Carrega fotos em qualidade menor e não toca vídeos sozinho no feed.')}
          value={settings.dataSaver}
          onChange={(dataSaver) => update({ dataSaver, autoplayVideos: dataSaver ? false : settings.autoplayVideos })}
        />
        <ToggleRow
          icon="play-circle-outline"
          label={t('Reproduzir vídeos automaticamente no feed')}
          value={settings.autoplayVideos && !settings.dataSaver}
          disabled={settings.dataSaver}
          onChange={(autoplayVideos) => update({ autoplayVideos })}
        />
      </Section>
      <InfoText>{t('As preferências ficam salvas neste celular.')}</InfoText>
    </SettingsScreen>
  );
}
