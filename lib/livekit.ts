// Vídeo ao vivo das batalhas (LiveKit).
// Só funciona no app instalado (APK). No Expo Go e no navegador o app continua abrindo,
// mas cada lado vê apenas a própria câmera.
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

export const liveVideoAvailable =
  Platform.OS !== 'web' && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

type LiveVideoModule = typeof import('@/components/LiveVideoImpl');
let mod: LiveVideoModule | null = null;

/** Carrega o módulo de vídeo só quando ele existe (no Expo Go ele quebraria o app). */
export function getLiveVideo(): LiveVideoModule | null {
  if (!liveVideoAvailable) return null;
  if (!mod) mod = require('@/components/LiveVideoImpl') as LiveVideoModule;
  return mod;
}
