// Escolher uma foto e publicar no story (usado na barra de stories e no + da foto do perfil).
import * as ImagePicker from 'expo-image-picker';

import { useOverlay } from '@/components/Overlay';
import { useSettings } from '@/lib/settings';
import { useApp } from '@/lib/store';

export function useStoryPicker() {
  const { addStory } = useApp();
  const { showSheet, showBanner } = useOverlay();
  const { settings } = useSettings();

  return async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    const uri = !result.canceled ? result.assets[0]?.uri : undefined;
    if (!uri) return;
    const friends = settings.closeFriendIds.length;
    const publish = (close: boolean) => {
      addStory(uri, close);
      showBanner(close ? 'Story publicado para os melhores amigos.' : 'Story publicado.', { icon: 'checkmark-circle', tone: 'success' });
    };
    // sem lista de melhores amigos: publica direto para todos
    if (!friends) return publish(false);
    await new Promise((r) => setTimeout(r, 350));
    showSheet({
      title: 'Compartilhar story com',
      options: [
        { label: 'Todos', icon: 'people-outline', onPress: () => publish(false) },
        { label: `Melhores amigos (${friends})`, icon: 'star-outline', onPress: () => publish(true) },
      ],
    });
  };
}
