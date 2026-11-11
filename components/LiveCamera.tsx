import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { themed } from '@/lib/theme';
/**
 * Câmera ao vivo do próprio usuário (prévia local).
 * Por enquanto a imagem aparece só no seu celular; enviar para a plateia
 * exige um serviço de transmissão (ver README).
 */
export function LiveCamera() {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('front');
  const [off, setOff] = useState(false);

  // Ainda carregando o status da permissão
  if (!permission) return <View style={styles.box} />;

  if (!permission.granted) {
    return (
      <View style={[styles.box, styles.center]}>
        <Ionicons name="videocam-off-outline" size={30} color="#fff" />
        <Text style={styles.text}>Permita o uso da câmera para entrar ao vivo</Text>
        <Pressable
          style={styles.button}
          onPress={() => (permission.canAskAgain ? requestPermission() : Linking.openSettings())}>
          <Text style={styles.buttonText}>{permission.canAskAgain ? 'Permitir câmera' : 'Abrir configurações'}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.box}>
      {off ? (
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <Ionicons name="videocam-off" size={30} color="rgba(255,255,255,0.7)" />
          <Text style={styles.text}>Câmera desligada</Text>
        </View>
      ) : (
        <CameraView style={StyleSheet.absoluteFill} facing={facing} mirror={facing === 'front'} />
      )}
      <View style={styles.controls}>
        <Pressable style={styles.control} hitSlop={6} onPress={() => setOff((v) => !v)}>
          <Ionicons name={off ? 'videocam' : 'videocam-off'} size={16} color="#fff" />
        </Pressable>
        {!off ? (
          <Pressable style={styles.control} hitSlop={6} onPress={() => setFacing((f) => (f === 'front' ? 'back' : 'front'))}>
            <Ionicons name="camera-reverse" size={16} color="#fff" />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  box: { ...StyleSheet.absoluteFill, backgroundColor: '#1E293B' },
  center: { alignItems: 'center', justifyContent: 'center', gap: 8, padding: 10 },
  text: { color: 'rgba(255,255,255,0.85)', fontSize: 12, textAlign: 'center' },
  button: { backgroundColor: '#E11D48', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  controls: { position: 'absolute', top: 8, right: 8, gap: 8 },
  control: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 16,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
