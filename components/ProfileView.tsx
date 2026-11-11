import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { compactNumber } from '@/lib/format';
import { useSettings } from '@/lib/settings';
import { useApp, useMe } from '@/lib/store';
import { useOverlay } from './Overlay';
import { colors, spacing, themed } from '@/lib/theme';
import type { User } from '@/lib/types';
import { Avatar } from './Avatar';
import { FollowButton, SecondaryButton } from './FollowButton';
import { PostGrid } from './PostGrid';

type Tab = 'posts' | 'videos' | 'saved';

export function ProfileView({ user }: { user: User }) {
  const me = useMe();
  const { postsBy, posts, followersOf, followingOf, storyUsers, openConversationWith, consentFor, supportersFor, canSeeContent, canInteract, activityText, giveConsent } = useApp();
  const { accountSettings, settings } = useSettings();
  const { showBanner } = useOverlay();
  const [tab, setTab] = useState<Tab>('posts');
  const isMe = user.id === me.id;

  const userPosts = postsBy(user.id);
  const shown =
    tab === 'posts'
      ? userPosts
      : tab === 'videos'
        ? userPosts.filter((p) => p.type === 'video')
        : posts.filter((p) => p.savedBy.includes(me.id));
  const story = storyUsers().find((s) => s.user.id === user.id);

  const visible = canSeeContent(user.id);
  const isPrivate = accountSettings(user.id).privateAccount;
  const activity = isMe ? null : activityText(user.id);

  const onMessage = () => {
    const id = openConversationWith(user.id);
    if (id) router.push(`/messages/${id}`);
    else if (!canInteract(user.id, 'message'))
      showBanner(`@${user.username} não recebe mensagens de você.`, { icon: 'chatbubbles-outline', tone: 'warning' });
  };

  const onShare = () => {
    Share.share({ message: `Siga @${user.username} na Rede Política` }).catch(() => {});
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.top}>
        <Pressable onPress={() => story && router.push(`/story/${user.id}`)}>
          <Avatar uri={user.avatar} size={84} ring={story ? (story.seen ? 'seen' : story.closeFriends ? 'close' : 'unseen') : 'none'} />
        </Pressable>
        <View style={styles.stats}>
          <Stat value={userPosts.length} label="publicações" />
          <Stat
            value={followersOf(user.id).length}
            label="seguidores"
            onPress={() => router.push(`/follows/${user.username}?tab=followers`)}
          />
          <Stat
            value={followingOf(user.id).length}
            label="seguindo"
            onPress={() => router.push(`/follows/${user.username}?tab=following`)}
          />
        </View>
      </View>

      <View style={styles.bio}>
        <Text style={styles.name}>
          {user.name}
          {isPrivate ? <Text style={styles.role}>  🔒 conta privada</Text> : null}
        </Text>
        {activity ? <Text style={styles.activity}>● {activity}</Text> : null}
        {user.role || user.party ? (
          <Text style={styles.role}>{[user.role, user.party].filter(Boolean).join(' • ')}</Text>
        ) : null}
        {user.accountType === 'politico' ? (
          <View style={styles.politicalBadge}>
            <Ionicons name="business-outline" size={12} color={colors.infoText} />
            <Text style={styles.politicalText}>
              Conta política{user.city ? ` · ${user.city}${user.state ? `/${user.state}` : ''}` : ''}
            </Text>
          </View>
        ) : null}
        {user.bio ? <Text style={styles.bioText}>{user.bio}</Text> : null}
        {user.website ? (
          <Text style={styles.link} onPress={() => Linking.openURL(`https://${user.website}`).catch(() => {})}>
            <Ionicons name="link" size={13} /> {user.website}
          </Text>
        ) : null}
      </View>

      {isMe && user.accountType === 'politico' ? (
        <Pressable style={styles.panelCard} onPress={() => router.push('/painel')}>
          <Ionicons name="bar-chart" size={20} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.panelTitle}>Painel do político</Text>
            <Text style={styles.panelSub}>
              Público, desempenho e {supportersFor(user.id).length + 40} apoiadores cadastrados
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      ) : null}

      <View style={styles.buttons}>
        {isMe ? (
          <>
            <SecondaryButton flex label="Editar perfil" onPress={() => router.push('/edit-profile')} />
            <SecondaryButton flex label="Compartilhar perfil" onPress={onShare} />
          </>
        ) : (
          <>
            <View style={{ flex: 1 }}>
              <FollowButton userId={user.id} />
            </View>
            <SecondaryButton flex label="Mensagem" onPress={onMessage} />
          </>
        )}
      </View>
      {!isMe && user.accountType === 'politico' ? (
        <Pressable
          style={[styles.supportBtn, consentFor(user.id) && styles.supportBtnOn]}
          onPress={() => {
            // Já autorizado: abre para alterar ou cancelar
            if (consentFor(user.id)) return router.push(`/apoiar/${user.username}`);
            // Perfil de compartilhamento escolhido antes (cadastro/Configurações): 1 toque
            const sp = settings.shareProfile;
            if (sp?.fields.length) {
              const err = giveConsent(user.id, { ...sp, email: sp.email ?? settings.email, whatsapp: sp.whatsapp ?? settings.phone });
              if (!err) return showBanner(`Pronto! Você vai receber novidades de ${user.name}. Toque de novo para alterar ou cancelar.`, { icon: 'notifications', tone: 'success' });
            }
            // Sem perfil definido (ou faltou algum contato): abre o formulário
            router.push(`/apoiar/${user.username}`);
          }}>
          <Ionicons
            name={consentFor(user.id) ? 'notifications' : 'notifications-outline'}
            size={16}
            color={consentFor(user.id) ? colors.infoText : colors.white}
          />
          <Text style={[styles.supportText, consentFor(user.id) && { color: colors.infoText }]}>
            {consentFor(user.id) ? 'Você recebe novidades · alterar' : 'Quero receber novidades'}
          </Text>
        </Pressable>
      ) : null}

      <View style={styles.tabs}>
        <TabIcon icon="grid" active={tab === 'posts'} onPress={() => setTab('posts')} />
        <TabIcon icon="play-circle" active={tab === 'videos'} onPress={() => setTab('videos')} />
        {isMe ? <TabIcon icon="bookmark" active={tab === 'saved'} onPress={() => setTab('saved')} /> : null}
      </View>

      {!visible ? (
        <View style={styles.privateBox}>
          <Ionicons name="lock-closed-outline" size={40} color={colors.text} />
          <Text style={styles.privateTitle}>Esta conta é privada</Text>
          <Text style={styles.privateText}>Siga para ver as fotos e vídeos. A pessoa precisa aprovar o seu pedido.</Text>
        </View>
      ) : null}
      {visible ? <PostGrid
        posts={shown}
        emptyText={tab === 'saved' ? 'Nada salvo ainda' : tab === 'videos' ? 'Nenhum vídeo ainda' : 'Nenhuma publicação ainda'}
      /> : null}
    </ScrollView>
  );
}

function Stat({ value, label, onPress }: { value: number; label: string; onPress?: () => void }) {
  return (
    <Pressable style={styles.stat} onPress={onPress} disabled={!onPress}>
      <Text style={styles.statValue}>{compactNumber(value)}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Pressable>
  );
}

function TabIcon({
  icon,
  active,
  onPress,
}: {
  icon: 'grid' | 'play-circle' | 'bookmark';
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <Ionicons name={active ? icon : (`${icon}-outline` as const)} size={22} color={active ? colors.text : colors.textMuted} />
    </Pressable>
  );
}

const styles = themed(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  top: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, gap: spacing.xl },
  stats: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center' },
  statValue: { fontWeight: '700', fontSize: 17, color: colors.text },
  statLabel: { fontSize: 13, color: colors.text },
  bio: { paddingHorizontal: spacing.lg, gap: 2 },
  name: { fontWeight: '600', color: colors.text },
  role: { color: colors.textMuted, fontSize: 13 },
  bioText: { color: colors.text, lineHeight: 19 },
  link: { color: colors.infoText, fontWeight: '600' },
  buttons: { flexDirection: 'row', gap: spacing.sm, padding: spacing.lg },
  activity: { color: colors.good, fontSize: 12, fontWeight: '600' },
  privateBox: { alignItems: 'center', gap: 8, paddingVertical: 40, paddingHorizontal: 32 },
  privateTitle: { fontWeight: '700', fontSize: 16, color: colors.text },
  privateText: { color: colors.textMuted, textAlign: 'center' },
  politicalBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: colors.infoBg, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginVertical: 2 },
  politicalText: { color: colors.infoText, fontSize: 12, fontWeight: '600' },
  panelCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginHorizontal: spacing.lg, marginTop: spacing.md, padding: spacing.md, borderRadius: 12, backgroundColor: colors.surface },
  panelTitle: { fontWeight: '700', color: colors.text },
  panelSub: { color: colors.textMuted, fontSize: 12, marginTop: 1 },
  supportBtn: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', marginHorizontal: spacing.lg, marginTop: -spacing.sm, marginBottom: spacing.md, paddingVertical: 9, borderRadius: 8, backgroundColor: colors.primary },
  supportBtnOn: { backgroundColor: colors.selectedBg },
  supportText: { color: colors.white, fontWeight: '700' },
  tabs: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
  tabActive: { borderBottomWidth: 1.5, borderBottomColor: colors.text },
}));
