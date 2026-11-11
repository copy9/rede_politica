// Sala de vídeo da batalha (LiveKit). Carregado só no app instalado: veja lib/livekit.ts.
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  AudioSession,
  LiveKitRoom,
  VideoTrack,
  isTrackReference,
  registerGlobals,
  useLocalParticipant,
  useTracks,
} from '@livekit/react-native';
import { Track } from 'livekit-client';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LIVEKIT_URL } from '@/lib/config';
import { supabase } from '@/lib/supabase';

registerGlobals();

/** Entra na sala de vídeo da batalha. Quem debate transmite câmera e microfone; a plateia só assiste e ouve. */
export function BattleRoom({ battleId, speaker, children }: { battleId: string; speaker: boolean; children: React.ReactNode }) {
  const [token, setToken] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    AudioSession.startAudioSession().catch(() => {});
    supabase.functions
      .invoke('livekit-token', { body: { battleId } })
      .then(({ data, error: err }) => {
        if (!alive) return;
        if (err || !data?.token) setError('Não deu para conectar o vídeo. Verifique a internet.');
        else setToken(data.token as string);
      });
    return () => {
      alive = false;
      AudioSession.stopAudioSession().catch(() => {});
    };
  }, [battleId]);

  return (
    <LiveKitRoom
      serverUrl={LIVEKIT_URL}
      token={token}
      connect={!!token}
      audio={speaker}
      video={speaker ? { facingMode: 'user' } : false}
      options={{ adaptiveStream: true, dynacast: true }}
      onError={() => setError('O vídeo caiu. Tentando de novo…')}>
      {children}
      {error ? (
        <View style={styles.error} pointerEvents="none">
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </LiveKitRoom>
  );
}

/** Vídeo de uma pessoa da batalha (ou o `fallback` enquanto não chega). */
export function SideVideo({ userId, isMe, fallback }: { userId: string; isMe: boolean; fallback: React.ReactNode }) {
  const tracks = useTracks([Track.Source.Camera]);
  const ref = tracks.find((t) => t.participant.identity === userId && isTrackReference(t) && !t.publication.isMuted);
  return (
    <View style={StyleSheet.absoluteFill}>
      {ref && isTrackReference(ref) ? (
        <VideoTrack trackRef={ref} style={StyleSheet.absoluteFill} objectFit="cover" mirror={isMe} />
      ) : (
        fallback
      )}
      {isMe ? <MyControls /> : null}
    </View>
  );
}

/** Botões de quem está debatendo: ligar/desligar câmera e microfone, trocar de câmera. */
function MyControls() {
  const { localParticipant, isCameraEnabled, isMicrophoneEnabled, cameraTrack } = useLocalParticipant();
  const [front, setFront] = useState(true);
  const flip = async () => {
    const track = cameraTrack?.track as { restartTrack?: (o: { facingMode: string }) => Promise<void> } | undefined;
    if (!track?.restartTrack) return;
    await track.restartTrack({ facingMode: front ? 'environment' : 'user' }).catch(() => {});
    setFront(!front);
  };
  return (
    <View style={styles.controls}>
      <Round icon={isMicrophoneEnabled ? 'mic' : 'mic-off'} onPress={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)} />
      <Round icon={isCameraEnabled ? 'videocam' : 'videocam-off'} onPress={() => localParticipant.setCameraEnabled(!isCameraEnabled)} />
      {isCameraEnabled ? <Round icon="camera-reverse" onPress={flip} /> : null}
    </View>
  );
}

function Round({ icon, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} style={styles.round}>
      <Ionicons name={icon} size={18} color="#fff" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  controls: { position: 'absolute', top: 8, right: 8, gap: 8 },
  round: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  error: { position: 'absolute', top: 8, left: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 8, padding: 6 },
  errorText: { color: '#fff', fontSize: 12, textAlign: 'center' },
});
