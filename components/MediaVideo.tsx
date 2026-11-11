import Ionicons from '@expo/vector-icons/Ionicons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

type Props = {
  uri: string;
  /** Toca só quando estiver visível na tela */
  active: boolean;
  style?: ViewStyle;
  /** No feed começa mudo (como nas redes sociais); nos vídeos em tela cheia, com som */
  startMuted?: boolean;
  onPress?: () => void;
};

export function MediaVideo({ uri, active, style, startMuted = true, onPress }: Props) {
  const [muted, setMuted] = useState(startMuted);
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = startMuted;
  });

  useEffect(() => {
    if (active) player.play();
    else player.pause();
  }, [active, player]);

  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);

  return (
    <Pressable style={style} onPress={onPress}>
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
      <View style={styles.muteWrap} pointerEvents="box-none">
        <Pressable onPress={() => setMuted((m) => !m)} style={styles.mute} hitSlop={10}>
          <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={14} color="#fff" />
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  muteWrap: { ...StyleSheet.absoluteFill, justifyContent: 'flex-end', alignItems: 'flex-end', padding: 12 },
  mute: { backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 14, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
});
