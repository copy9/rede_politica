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
            { value: 'pt-BR', label: 'Português' },
            { value: 'en', label: 'English' },
            { value: 'es', label: 'Español' },
          ]}
        />
      </Section>
      <InfoText>
        {t(
          'O app inteiro muda de idioma na hora. Publicações, comentários e nomes que as pessoas escrevem continuam como foram escritos.',
        )}
      </InfoText>
    </SettingsScreen>
  );
}
