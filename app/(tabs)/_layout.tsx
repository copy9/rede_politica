import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { useMe } from '@/lib/store';
import { colors } from '@/lib/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function icon(filled: IconName, outline: IconName) {
  return ({ focused, color }: { focused: boolean; color: ColorValue }) => (
    <Ionicons name={focused ? filled : outline} size={26} color={String(color)} />
  );
}

export default function TabLayout() {
  const me = useMe();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.text,
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Início', tabBarIcon: icon('home', 'home-outline') }} />
      <Tabs.Screen name="explore" options={{ title: 'Explorar', tabBarIcon: icon('search', 'search-outline') }} />
      <Tabs.Screen name="create" options={{ title: 'Publicar', tabBarIcon: icon('add-circle', 'add-circle-outline') }} />
      <Tabs.Screen name="videos" options={{ title: 'Vídeos', tabBarIcon: icon('play-circle', 'play-circle-outline') }} />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ focused }) => (
            <Avatar uri={me.avatar} size={focused ? 26 : 24} ring={focused ? 'seen' : 'none'} />
          ),
        }}
      />
      <Tabs.Screen name="battles" options={{ title: 'Batalhas', tabBarIcon: icon('flash', 'flash-outline') }} />
    </Tabs>
  );
}
