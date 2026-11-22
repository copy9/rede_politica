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
import { Camera } from 'expo-camera';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { LIVEKIT_URL } from '@/lib/config';
import { supabase } from '@/lib/supabase';
import { LiveCamera } from './LiveCamera';

registerGlobals();

/** false quando a sala de vídeo não conectou (aí quem debate vê ao menos a própria câmera) */
const ConnectedContext = createContext(false);
/** câmera da frente ou de trás (para voltar na mesma quando o app reabre) */
let facing: 'user' | 'environment' = 'user';

/** Entra na sala de vídeo da batalha. Quem debate transmite câmera e microfone; a plateia só assiste e ouve. */
export function BattleRoom({ battleId, speaker, children, style }: { battleId: string; speaker: boolean; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const [token, setToken] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  const [connected, setConnected] = useState(false);
  const connectedRef = useRef(false);
  connectedRef.current = connected;
  // se a conexão caiu enquanto a tela estava apagada/minimizada, entra de novo sozinho ao voltar
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active' && !connectedRef.current) setAttempt((n) => n + 1);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      // pede câmera e microfone logo ao entrar (quem debate)
      if (speaker) {
        const cam = await Camera.requestCameraPermissionsAsync().catch(() => null);
        const mic = await Camera.requestMicrophonePermissionsAsync().catch(() => null);
        if (alive && (!cam?.granted || !mic?.granted))
          setError('Permita a câmera e o microfone nas configurações do celular para aparecer na batalha.');
      }
      await AudioSession.startAudioSession().catch(() => {});
      const { data, error: err } = await supabase.functions.invoke('livekit-token', { body: { battleId } });
      if (!alive) return;
      if (err || !data?.token) {
        // mostra o motivo que o servidor mandou
        let reason = 'Verifique a internet.';
        try {
          const body = await (err as { context?: Response })?.context?.json();
          if (body?.error) reason = body.error;
        } catch {
          // sem detalhe
        }
        setError(`Vídeo ao vivo indisponível: ${reason}`);
      } else setToken(data.token as string);
    })();
    return () => {
      alive = false;
      AudioSession.stopAudioSession().catch(() => {});
    };
  }, [battleId, attempt]);

  return (
    <LiveKitRoom
      key={attempt}
      serverUrl={LIVEKIT_URL}
      token={token}
      connect={!!token}
      audio={speaker}
      video={speaker ? { facingMode: facing } : false}
      options={{ adaptiveStream: true, dynacast: true }}
      onConnected={() => {
        setConnected(true);
        setError(null);
      }}
      onDisconnected={() => setConnected(false)}
      onError={(e) => setError(`O vídeo caiu: ${e.message}`)}
      onMediaDeviceFailure={() => setError('Não deu para abrir a câmera ou o microfone. Feche outros apps que usam a câmera e entre de novo.')}>
      <ConnectedContext.Provider value={connected}>
        {speaker ? <ResumeOnForeground /> : null}
        <View style={style}>
          {children}
          {error ? (
            <View style={styles.error} pointerEvents="none">
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
        </View>
      </ConnectedContext.Provider>
    </LiveKitRoom>
  );
}

/**
 * Quando a tela apaga ou o app é minimizado, o Android tira a câmera do app.
 * Ao voltar, religa sozinho a câmera (na mesma lente) e o microfone de quem está transmitindo.
 */
function ResumeOnForeground() {
  const { localParticipant } = useLocalParticipant();
  const wanted = useRef({ cam: true, mic: true });
  useEffect(() => {
    let last = AppState.currentState;
    const sub = AppState.addEventListener('change', async (st) => {
      const wasAway = last !== 'active';
      if (st !== 'active') {
        // guarda o que estava ligado antes de sair
        if (last === 'active') wanted.current = { cam: localParticipant.isCameraEnabled, mic: localParticipant.isMicrophoneEnabled };
        last = st;
        return;
      }
      last = st;
      if (!wasAway) return;
      if (wanted.current.cam) {
        const pub = localParticipant.getTrackPublication(Track.Source.Camera);
        const track = pub?.track as { restartTrack?: (o: { facingMode: string }) => Promise<void> } | undefined;
        try {
          if (track?.restartTrack) await track.restartTrack({ facingMode: facing });
          else await localParticipant.setCameraEnabled(true, { facingMode: facing });
        } catch {
          // a câmera não voltou com o restart: desliga e liga de novo
          await localParticipant.setCameraEnabled(false).catch(() => {});
          await localParticipant.setCameraEnabled(true, { facingMode: facing }).catch(() => {});
        }
      }
      if (wanted.current.mic) await localParticipant.setMicrophoneEnabled(true).catch(() => {});
    });
    return () => sub.remove();
  }, [localParticipant]);
  return null;
}

/** Vídeo de uma pessoa da batalha (ou o `fallback` enquanto não chega). */
export function SideVideo({ userId, isMe, fallback, controlsTop = 8 }: { userId: string; isMe: boolean; fallback: React.ReactNode; controlsTop?: number }) {
  const connected = useContext(ConnectedContext);
  const tracks = useTracks([Track.Source.Camera]);
  // antes era aberta a câmera do celular aqui enquanto conectava, e isso travava a transmissão do vídeo para os outros
  void connected;
  const ref = tracks.find((t) => t.participant.identity === userId && isTrackReference(t) && !t.publication.isMuted);
  return (
    <View style={StyleSheet.absoluteFill}>
      {ref && isTrackReference(ref) ? (
        <VideoTrack trackRef={ref} style={StyleSheet.absoluteFill} objectFit="cover" mirror={isMe} />
      ) : (
        fallback
      )}
      {isMe ? <MyControls top={controlsTop} /> : null}
    </View>
  );
}

/** Botões de quem está debatendo: ligar/desligar câmera e microfone, trocar de câmera. */
function MyControls({ top = 8 }: { top?: number }) {
  const { localParticipant, isCameraEnabled, isMicrophoneEnabled, cameraTrack } = useLocalParticipant();
  const [front, setFront] = useState(facing === 'user');
  const flip = async () => {
    const track = cameraTrack?.track as { restartTrack?: (o: { facingMode: string }) => Promise<void> } | undefined;
    if (!track?.restartTrack) return;
    const next = front ? 'environment' : 'user';
    await track.restartTrack({ facingMode: next }).catch(() => {});
    facing = next;
    setFront(!front);
  };
  return (
    <View style={[styles.controls, { top }]}>
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
  error: { position: 'absolute', bottom: 40, left: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 8, padding: 6 },
  errorText: { color: '#fff', fontSize: 12, textAlign: 'center' },
});
