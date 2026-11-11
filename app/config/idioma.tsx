import { InfoText, RadioGroup, Section, SettingsScreen } from '@/components/SettingsUI';
import { useT } from '@/lib/i18n';
import { useSettings } from '@/lib/settings';

export default function LanguageScreen() {
  const { settings, update } = useSettings();
  const t = useT();
  return (
    <SettingsScreen>
      <Section title={t('Idioma do app')}>
        <RadioGroup
          value={settings.language}
          onChange={(language) => update({ language })}
          options={[
            { value: 'pt-BR', label: 'Português (Brasil)' },
            { value: 'en', label: 'English' },
            { value: 'es', label: 'Español' },
          ]}
        />
      </Section>
      <InfoText>
        {t(
          'Tradução parcial: a página de Configurações, os títulos das telas, o login e esta página já estão traduzidos. As demais telas ainda aparecem em português.',
        )}
      </InfoText>
    </SettingsScreen>
  );
}
