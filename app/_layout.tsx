import { DarkTheme, DefaultTheme, Stack, ThemeProvider, router, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { useColorScheme } from 'react-native';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { OverlayProvider } from '@/components/Overlay';
import { UsageTracker } from '@/components/UsageTracker';
import { useT } from '@/lib/i18n';
import { SettingsProvider, useSettings } from '@/lib/settings';
import { AppProvider, useApp } from '@/lib/store';
import { colors, schemeFrom, setScheme } from '@/lib/theme';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <AppProvider>
          <ThemedApp />
        </AppProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}

/** Aplica o tema (claro/escuro/automático) e redesenha o app quando ele muda. */
function ThemedApp() {
  const { settings, loaded } = useSettings();
  const system = useColorScheme();
  const scheme = schemeFrom(settings.themeMode, system);
  // Precisa acontecer antes de desenhar as telas, para os estilos pegarem as cores certas.
  setScheme(scheme);

  // Guarda a tela atual para voltar para ela depois que o tema muda
  const pathname = usePathname();
  const prevScheme = useRef<string | null>(null);
  const changes = useRef(0);
  const pathAtChange = useRef(pathname);
  // Só conta trocas feitas depois de carregar as configurações salvas
  if (loaded && prevScheme.current === null) prevScheme.current = scheme;
  if (loaded && prevScheme.current !== scheme) {
    prevScheme.current = scheme;
    changes.current += 1;
    pathAtChange.current = pathname;
  }

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  // Espera carregar as configurações salvas para não "piscar" o tema errado.
  if (!loaded) return null;

  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.background,
      text: colors.text,
      border: colors.border,
    },
  };

  return (
    <OverlayProvider key={`overlay-${scheme}`}>
    <ThemeProvider value={navTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <UsageTracker />
      {/* key: troca de tema redesenha tudo; RestorePath volta para a tela onde a pessoa estava */}
      <RootNavigator key={scheme} />
      {changes.current > 0 ? <RestorePath key={`restore-${changes.current}`} path={pathAtChange.current} /> : null}
    </ThemeProvider>
    </OverlayProvider>
  );
}

function RestorePath({ path }: { path: string }) {
  const target = useRef(path).current;
  useEffect(() => {
    if (!target || target === '/') return;
    const t = setTimeout(() => {
      try {
        router.push(target as never);
      } catch {
        // se a rota não existir mais, fica no início
      }
    }, 50);
    return () => clearTimeout(t);
  }, [target]);
  return null;
}

function RootNavigator() {
  const { me } = useApp();
  const loggedIn = !!me;
  const t = useT();

  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal', headerShadowVisible: false }}>
      {/* Telas visíveis só sem login */}
      <Stack.Protected guard={!loggedIn}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="signup" options={{ headerShown: false }} />
      </Stack.Protected>

      {/* Telas visíveis só com login */}
      <Stack.Protected guard={loggedIn}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="post/[id]" options={{ title: t('Publicação') }} />
        <Stack.Screen name="comments/[id]" options={{ title: t('Comentários'), presentation: 'modal' }} />
        <Stack.Screen name="likes/[id]" options={{ title: t('Curtidas') }} />
        <Stack.Screen name="user/[username]" options={{ title: '' }} />
        <Stack.Screen name="follows/[username]" options={{ title: '' }} />
        <Stack.Screen name="edit-profile" options={{ title: t('Editar perfil'), presentation: 'modal' }} />
        <Stack.Screen name="notifications" options={{ title: t('Notificações') }} />
        <Stack.Screen name="messages/index" options={{ title: t('Mensagens') }} />
        <Stack.Screen name="messages/[id]" options={{ title: '' }} />
        <Stack.Screen
          name="story/[userId]"
          options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade' }}
        />
        <Stack.Screen name="settings" options={{ title: t('Configurações') }} />
        <Stack.Screen name="painel" options={{ title: t('Painel do político') }} />
        <Stack.Screen name="apoiar/[username]" options={{ title: t('Receber novidades'), presentation: 'modal' }} />
        <Stack.Screen name="autorizacoes" options={{ title: t('Minhas autorizações') }} />
        <Stack.Screen name="salvos" options={{ title: t('Salvos') }} />
        <Stack.Screen name="atividade" options={{ title: t('Sua atividade') }} />
        <Stack.Screen name="config/aparencia" options={{ title: t('Aparência') }} />
        <Stack.Screen name="config/notificacoes" options={{ title: t('Notificações') }} />
        <Stack.Screen name="config/privacidade" options={{ title: t('Privacidade da conta') }} />
        <Stack.Screen name="config/bloqueados" options={{ title: t('Bloqueados e silenciados') }} />
        <Stack.Screen name="config/comentarios" options={{ title: t('Comentários') }} />
        <Stack.Screen name="config/seguranca" options={{ title: t('Senha e segurança') }} />
        <Stack.Screen name="config/dados-pessoais" options={{ title: t('Informações pessoais') }} />
        <Stack.Screen name="config/melhores-amigos" options={{ title: t('Melhores amigos') }} />
        <Stack.Screen name="config/idioma" options={{ title: t('Idioma') }} />
        <Stack.Screen name="config/verificacao" options={{ title: t('Verificação') }} />
        <Stack.Screen name="config/ajuda" options={{ title: t('Ajuda') }} />
        <Stack.Screen name="config/sobre" options={{ title: t('Sobre') }} />
        <Stack.Screen name="battle/new" options={{ title: t('Nova batalha'), presentation: 'modal' }} />
        <Stack.Screen name="battle/[id]" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
      </Stack.Protected>
      <Stack.Screen name="+not-found" options={{ title: t('Página não encontrada') }} />
    </Stack>
  );
}
