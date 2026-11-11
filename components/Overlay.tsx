// Avisos rápidos (banner no topo) e menus de opções (sobem de baixo).
// Funcionam igual no celular e no navegador, ao contrário do Alert com botões.
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing, themed } from '@/lib/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export type SheetOption = { label: string; onPress?: () => void; destructive?: boolean; icon?: IconName };
type Sheet = { title?: string; message?: string; options: SheetOption[] };
type Banner = { id: number; text: string; icon?: IconName; tone?: 'info' | 'success' | 'warning' };

type OverlayState = {
  showSheet: (sheet: Sheet) => void;
  /** pergunta de confirmação (sim/não) */
  confirm: (title: string, message: string, confirmLabel: string, onConfirm: () => void, destructive?: boolean) => void;
  showBanner: (text: string, opts?: { icon?: IconName; tone?: Banner['tone']; durationMs?: number }) => void;
};

const OverlayContext = createContext<OverlayState | null>(null);

export function OverlayProvider({ children }: { children: React.ReactNode }) {
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [banner, setBanner] = useState<Banner | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showSheet = useCallback((s: Sheet) => setSheet(s), []);
  const confirm = useCallback(
    (title: string, message: string, confirmLabel: string, onConfirm: () => void, destructive = false) =>
      setSheet({ title, message, options: [{ label: confirmLabel, onPress: onConfirm, destructive }] }),
    [],
  );
  const showBanner = useCallback(
    (text: string, opts?: { icon?: IconName; tone?: Banner['tone']; durationMs?: number }) => {
      if (timer.current) clearTimeout(timer.current);
      setBanner({ id: Date.now(), text, icon: opts?.icon, tone: opts?.tone });
      timer.current = setTimeout(() => setBanner(null), opts?.durationMs ?? 4000);
    },
    [],
  );
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const value = useMemo(() => ({ showSheet, confirm, showBanner }), [showSheet, confirm, showBanner]);

  return (
    <OverlayContext.Provider value={value}>
      {children}
      {banner ? <BannerView key={banner.id} banner={banner} onClose={() => setBanner(null)} /> : null}
      <SheetView sheet={sheet} onClose={() => setSheet(null)} />
    </OverlayContext.Provider>
  );
}

export function useOverlay() {
  const ctx = useContext(OverlayContext);
  if (!ctx) throw new Error('useOverlay precisa estar dentro de <OverlayProvider>');
  return ctx;
}

function BannerView({ banner, onClose }: { banner: Banner; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: 1, useNativeDriver: true }).start();
  }, [anim]);
  const toneColor = banner.tone === 'warning' ? colors.accent : banner.tone === 'success' ? colors.good : colors.primary;
  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.bannerWrap,
        { top: insets.top + 8, opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] },
      ]}>
      <Pressable style={[styles.banner, { borderLeftColor: toneColor }]} onPress={onClose} accessibilityRole="alert">
        <Ionicons name={banner.icon ?? 'information-circle'} size={20} color={toneColor} />
        <Text style={styles.bannerText}>{banner.text}</Text>
      </Pressable>
    </Animated.View>
  );
}

function SheetView({ sheet, onClose }: { sheet: Sheet | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={!!sheet} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]} onPress={() => {}}>
          {sheet?.title ? <Text style={styles.sheetTitle}>{sheet.title}</Text> : null}
          {sheet?.message ? <Text style={styles.sheetMessage}>{sheet.message}</Text> : null}
          {sheet?.options.map((o) => (
            <Pressable
              key={o.label}
              style={({ pressed }) => [styles.option, pressed && { backgroundColor: colors.surface }]}
              onPress={() => {
                onClose();
                // deixa o menu fechar antes de executar (evita abrir outro menu por cima)
                setTimeout(() => o.onPress?.(), 60);
              }}>
              {o.icon ? <Ionicons name={o.icon} size={22} color={o.destructive ? colors.like : colors.text} /> : null}
              <Text style={[styles.optionText, o.destructive && { color: colors.like, fontWeight: '700' }]}>{o.label}</Text>
            </Pressable>
          ))}
          <Pressable style={[styles.option, styles.cancel]} onPress={onClose}>
            <Text style={[styles.optionText, { fontWeight: '600', textAlign: 'center', flex: 1 }]}>Cancelar</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    bannerWrap: { position: 'absolute', left: 12, right: 12, alignItems: 'center', zIndex: 1000 },
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      maxWidth: 520,
      width: '100%',
      backgroundColor: colors.background,
      borderRadius: 12,
      borderLeftWidth: 4,
      paddingHorizontal: 14,
      paddingVertical: 12,
      shadowColor: '#000',
      shadowOpacity: 0.2,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    bannerText: { flex: 1, color: colors.text, fontSize: 14, lineHeight: 19 },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      paddingTop: spacing.md,
      maxWidth: 560,
      width: '100%',
      alignSelf: 'center',
    },
    sheetTitle: { fontWeight: '700', fontSize: 16, color: colors.text, textAlign: 'center', paddingHorizontal: spacing.lg, paddingTop: 4 },
    sheetMessage: { color: colors.textMuted, textAlign: 'center', paddingHorizontal: spacing.xl, paddingTop: 6, paddingBottom: spacing.sm, lineHeight: 19 },
    option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.xl, paddingVertical: 15 },
    optionText: { fontSize: 16, color: colors.text },
    cancel: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, marginTop: spacing.xs },
  }),
);
