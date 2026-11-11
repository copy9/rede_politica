import { InfoText, RadioGroup, Section, SettingsScreen } from '@/components/SettingsUI';
import { useSettings } from '@/lib/settings';

export default function LanguageScreen() {
  const { settings, update } = useSettings();
  return (
    <SettingsScreen>
      <Section title="Idioma do app">
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
      <InfoText>Por enquanto o app está todo em português. A tradução para inglês e espanhol vem numa próxima versão.</InfoText>
    </SettingsScreen>
  );
}
