import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppProvider, useApp } from '@/lib/store';
import { colors } from '@/lib/theme';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.background,
    text: colors.text,
    border: colors.border,
  },
};

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <SafeAreaProvider>
      <AppProvider>
        <ThemeProvider value={theme}>
          <StatusBar style="dark" />
          <RootNavigator />
        </ThemeProvider>
      </AppProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { me } = useApp();
  const loggedIn = !!me;

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
        <Stack.Screen name="post/[id]" options={{ title: 'Publicação' }} />
        <Stack.Screen name="comments/[id]" options={{ title: 'Comentários', presentation: 'modal' }} />
        <Stack.Screen name="likes/[id]" options={{ title: 'Curtidas' }} />
        <Stack.Screen name="user/[username]" options={{ title: '' }} />
        <Stack.Screen name="follows/[username]" options={{ title: '' }} />
        <Stack.Screen name="edit-profile" options={{ title: 'Editar perfil', presentation: 'modal' }} />
        <Stack.Screen name="notifications" options={{ title: 'Notificações' }} />
        <Stack.Screen name="messages/index" options={{ title: 'Mensagens' }} />
        <Stack.Screen name="messages/[id]" options={{ title: '' }} />
        <Stack.Screen
          name="story/[userId]"
          options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade' }}
        />
        <Stack.Screen name="settings" options={{ title: 'Configurações' }} />
      </Stack.Protected>
      <Stack.Screen name="+not-found" options={{ title: 'Página não encontrada' }} />
    </Stack>
  );
}
