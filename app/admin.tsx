// Administração da plataforma: só para contas de administrador (conferido também no banco).
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useOverlay } from '@/components/Overlay';
import { useMe } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { colors, spacing, themed } from '@/lib/theme';

type Tab = 'painel' | 'pedidos' | 'denuncias' | 'usuarios';
type Stats = Record<string, number> & { by_state: { label: string; total: number }[]; signups_14d: { day: string; total: number }[] };
type Request = { id: string; created_at: string; status: string; reason: string; user_id: string; username: string; name: string; account_type: string };
type Report = { id: string; created_at: string; status: string; reason: string; target_type: string; target_id: string | null; reporter_username: string };
type AdminUser = {
  id: string; username: string; name: string; email?: string | null; account_type: string; verified: boolean; is_admin: boolean;
  city: string | null; state: string | null; created_at: string; last_active_at: string | null; posts: number; followers: number;
};

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');
const STATUS: Record<string, string> = { aberto: 'Aguardando', aprovado: 'Aprovado', recusado: 'Recusado', resolvido: 'Resolvido' };

export default function AdminScreen() {
  const me = useMe();
  const { confirm, showBanner } = useOverlay();
  const [tab, setTab] = useState<Tab>('painel');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [requests, setRequests] = useState<Request[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const fail = (e: { message: string } | null) => e && showBanner(`Erro: ${e.message}`, { icon: 'alert-circle-outline', tone: 'warning' });
    if (tab === 'painel') {
      const { data, error } = await supabase.rpc('admin_stats');
      fail(error);
      if (data) setStats(data as Stats);
    } else if (tab === 'pedidos') {
      const { data, error } = await supabase.rpc('admin_requests');
      fail(error);
      setRequests((data as Request[]) ?? []);
    } else if (tab === 'denuncias') {
      const { data, error } = await supabase.rpc('admin_reports');
      fail(error);
      setReports((data as Report[]) ?? []);
    } else {
      const { data, error } = await supabase.rpc('admin_users', { search: search.trim() });
      fail(error);
      setUsers((data as AdminUser[]) ?? []);
    }
    setLoading(false);
  }, [tab, search, showBanner]);

  useEffect(() => {
    if (me.isAdmin) load();
  }, [tab, me.isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!me.isAdmin) return <Text style={styles.empty}>Área restrita a administradores.</Text>;

  const decide = (r: Request, approve: boolean) =>
    confirm(
      approve ? `Aprovar @${r.username}?` : `Recusar @${r.username}?`,
      approve ? 'A pessoa vira perfil público de político, com selo e Painel.' : 'A pessoa é avisada e pode pedir de novo.',
      approve ? 'Aprovar' : 'Recusar',
      async () => {
        const { data, error } = await supabase.rpc('admin_decide_request', { report_id: r.id, approve });
        showBanner(error ? `Erro: ${error.message}` : String(data), { icon: approve ? 'checkmark-circle' : 'close-circle', tone: error ? 'warning' : 'success' });
        load();
      },
      !approve,
    );

  const setPolitico = (u: AdminUser) => {
    const on = u.account_type !== 'politico';
    confirm(on ? `Liberar perfil público para @${u.username}?` : `Tirar perfil público de @${u.username}?`, on ? 'Recebe selo e Painel.' : 'Volta a ser usuário normal.', on ? 'Liberar' : 'Tirar', async () => {
      const { error } = await supabase.rpc('admin_set_politico', { target: u.id, on_off: on });
      if (error) showBanner(`Erro: ${error.message}`, { icon: 'alert-circle-outline', tone: 'warning' });
      load();
    }, !on);
  };

  // apagar usuário (de vez)
  const deleteUser = (u: AdminUser) => {
    confirm(
      `Apagar @${u.username}?`,
      `A conta${u.email ? ` ${u.email}` : ''} e tudo o que ela publicou (posts, comentários, mensagens, stories, lives) serão apagados de vez. Não dá para desfazer.`,
      'Apagar',
      async () => {
        const { error } = await supabase.rpc('admin_delete_user', { target: u.id });
        if (error) showBanner(`Erro: ${error.message}`, { icon: 'alert-circle-outline', tone: 'warning' });
        else showBanner(`@${u.username} foi apagado.`, { icon: 'trash-outline', tone: 'success' });
        load();
      },
      true,
    );
  };

  // trocar a senha de um usuário
  const [pwdUser, setPwdUser] = useState<AdminUser | null>(null);
  const [pwd, setPwd] = useState('');
  const [pwdShow, setPwdShow] = useState(false);
  const savePassword = async () => {
    if (!pwdUser) return;
    if (pwd.length < 6) return showBanner('A senha precisa ter pelo menos 6 caracteres.', { icon: 'alert-circle-outline', tone: 'warning' });
    const { error } = await supabase.rpc('admin_set_password', { target: pwdUser.id, new_password: pwd });
    if (error) return showBanner(`Erro: ${error.message}`, { icon: 'alert-circle-outline', tone: 'warning' });
    showBanner(`Senha de @${pwdUser.username} trocada.`, { icon: 'key-outline', tone: 'success' });
    setPwdUser(null);
    setPwd('');
  };

  const resolve = async (r: Report) => {
    const { error } = await supabase.rpc('admin_resolve_report', { report_id: r.id });
    if (error) showBanner(`Erro: ${error.message}`, { icon: 'alert-circle-outline', tone: 'warning' });
    load();
  };

  const refresh = <RefreshControl refreshing={loading} onRefresh={load} />;

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs} style={{ flexGrow: 0 }}>
        {(
          [
            ['painel', 'Painel'],
            ['pedidos', `Pedidos${stats?.requests_open ? ` (${stats.requests_open})` : ''}`],
            ['denuncias', `Denúncias${stats?.reports_open ? ` (${stats.reports_open})` : ''}`],
            ['usuarios', 'Usuários'],
          ] as [Tab, string][]
        ).map(([k, label]) => (
          <Pressable key={k} onPress={() => setTab(k)} style={[styles.tab, tab === k && styles.tabOn]}>
            <Text style={[styles.tabText, tab === k && { color: '#fff' }]}>{label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {tab === 'painel' ? (
        <ScrollView contentContainerStyle={styles.pad} refreshControl={refresh}>
          {!stats ? (
            <ActivityIndicator style={{ marginTop: 40 }} />
          ) : (
            <>
              <Group title="Usuários">
                <Stat label="Total" value={stats.users} />
                <Stat label="Usuários normais" value={stats.citizens} />
                <Stat label="Perfis públicos" value={stats.politicians} />
                <Stat label="Verificados" value={stats.verified} />
                <Stat label="Novos (7 dias)" value={stats.new_7d} />
                <Stat label="Novos (30 dias)" value={stats.new_30d} />
                <Stat label="Ativos (24h)" value={stats.active_24h} />
                <Stat label="Ativos (7 dias)" value={stats.active_7d} />
              </Group>
              <Group title="Conteúdo e interação">
                <Stat label="Publicações" value={stats.posts} />
                <Stat label="Publicações (7 dias)" value={stats.posts_7d} />
                <Stat label="Comentários" value={stats.comments} />
                <Stat label="Curtidas" value={stats.likes} />
                <Stat label="Seguidores (ligações)" value={stats.follows} />
                <Stat label="Stories" value={stats.stories} />
                <Stat label="Conversas" value={stats.conversations} />
                <Stat label="Mensagens" value={stats.messages} />
              </Group>
              <Group title="Debates e apoiadores">
                <Stat label="Debates" value={stats.battles} />
                <Stat label="Ao vivo agora" value={stats.battles_live} />
                <Stat label="Apoiadores (vínculos)" value={stats.supporters} />
                <Stat label="Administradores" value={stats.admins} />
              </Group>
              <Group title="Para conferir">
                <Stat label="Pedidos aguardando" value={stats.requests_open} onPress={() => setTab('pedidos')} />
                <Stat label="Denúncias abertas" value={stats.reports_open} onPress={() => setTab('denuncias')} />
              </Group>
              <Text style={styles.groupTitle}>Cadastros nos últimos 14 dias</Text>
              <Bars rows={stats.signups_14d.map((d) => ({ label: d.day, total: Number(d.total) }))} />
              <Text style={styles.groupTitle}>Usuários por estado</Text>
              <Bars rows={stats.by_state.map((d) => ({ label: d.label, total: Number(d.total) }))} />
            </>
          )}
        </ScrollView>
      ) : null}

      {tab === 'pedidos' ? (
        <FlatList
          data={requests}
          keyExtractor={(r) => r.id}
          refreshControl={refresh}
          contentContainerStyle={styles.pad}
          ListEmptyComponent={<Text style={styles.empty}>{loading ? 'Carregando…' : 'Nenhum pedido.'}</Text>}
          renderItem={({ item: r }) => (
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Pressable onPress={() => router.push(`/user/${r.username}`)} style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{r.name} · @{r.username}</Text>
                </Pressable>
                <Text style={[styles.badge, r.status === 'aberto' && styles.badgeOpen]}>{STATUS[r.status] ?? r.status}</Text>
              </View>
              <Text style={styles.muted}>{date(r.created_at)}</Text>
              <Text style={styles.body}>{r.reason}</Text>
              {r.status === 'aberto' ? (
                <View style={styles.actions}>
                  <Pressable style={[styles.btn, { backgroundColor: '#2563EB' }]} onPress={() => decide(r, true)}>
                    <Text style={styles.btnText}>Aprovar</Text>
                  </Pressable>
                  <Pressable style={[styles.btn, { backgroundColor: '#DC2626' }]} onPress={() => decide(r, false)}>
                    <Text style={styles.btnText}>Recusar</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          )}
        />
      ) : null}

      {tab === 'denuncias' ? (
        <FlatList
          data={reports}
          keyExtractor={(r) => r.id}
          refreshControl={refresh}
          contentContainerStyle={styles.pad}
          ListEmptyComponent={<Text style={styles.empty}>{loading ? 'Carregando…' : 'Nenhuma denúncia.'}</Text>}
          renderItem={({ item: r }) => (
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={[styles.cardTitle, { flex: 1 }]}>
                  {r.target_type} · por @{r.reporter_username}
                </Text>
                <Text style={[styles.badge, r.status === 'aberto' && styles.badgeOpen]}>{STATUS[r.status] ?? r.status}</Text>
              </View>
              <Text style={styles.muted}>{date(r.created_at)}</Text>
              <Text style={styles.body}>{r.reason}</Text>
              <View style={styles.actions}>
                {r.target_type === 'post' && r.target_id ? (
                  <Pressable style={[styles.btn, { backgroundColor: colors.surface }]} onPress={() => router.push(`/post/${r.target_id}`)}>
                    <Text style={[styles.btnText, { color: colors.text }]}>Ver publicação</Text>
                  </Pressable>
                ) : null}
                {r.status === 'aberto' ? (
                  <Pressable style={[styles.btn, { backgroundColor: '#2563EB' }]} onPress={() => resolve(r)}>
                    <Text style={styles.btnText}>Marcar resolvida</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          )}
        />
      ) : null}

      {tab === 'usuarios' ? (
        <FlatList
          data={users}
          keyExtractor={(u) => u.id}
          refreshControl={refresh}
          contentContainerStyle={styles.pad}
          ListHeaderComponent={
            <View style={styles.search}>
              <Ionicons name="search" size={16} color={colors.textMuted} />
              <TextInput
                placeholder="Buscar por nome, usuário ou e-mail"
                placeholderTextColor={colors.textMuted}
                value={search}
                onChangeText={setSearch}
                onSubmitEditing={load}
                returnKeyType="search"
                autoCapitalize="none"
                style={{ flex: 1, color: colors.text }}
              />
            </View>
          }
          ListEmptyComponent={<Text style={styles.empty}>{loading ? 'Carregando…' : 'Nenhum usuário.'}</Text>}
          renderItem={({ item: u }) => (
            <View style={styles.card}>
              <Pressable onPress={() => router.push(`/user/${u.username}`)}>
                <Text style={styles.cardTitle}>
                  {u.name} · @{u.username} {u.verified ? '✔' : ''} {u.is_admin ? '(admin)' : ''}
                </Text>
              </Pressable>
              {u.email ? <Text style={styles.muted}>{u.email}</Text> : null}
              <Text style={styles.muted}>
                {u.account_type === 'politico' ? 'Perfil público' : 'Usuário normal'} · {[u.city, u.state].filter(Boolean).join('/') || 'sem cidade'}
              </Text>
              <Text style={styles.muted}>
                Entrou em {date(u.created_at)} · último acesso {date(u.last_active_at)} · {u.posts} publicações · {u.followers} seguidores
              </Text>
              <View style={styles.actions}>
                <Pressable style={[styles.btn, { backgroundColor: u.account_type === 'politico' ? '#DC2626' : '#2563EB' }]} onPress={() => setPolitico(u)}>
                  <Text style={styles.btnText}>{u.account_type === 'politico' ? 'Tirar perfil público' : 'Liberar perfil público'}</Text>
                </Pressable>
                <Pressable style={[styles.btn, { backgroundColor: '#4B5563' }]} onPress={() => { setPwd(''); setPwdShow(false); setPwdUser(u); }}>
                  <Text style={styles.btnText}>Trocar senha</Text>
                </Pressable>
                {!u.is_admin ? (
                  <Pressable style={[styles.btn, { backgroundColor: '#991B1B' }]} onPress={() => deleteUser(u)}>
                    <Text style={styles.btnText}>Apagar usuário</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          )}
        />
      ) : null}

      <Modal visible={!!pwdUser} transparent animationType="fade" onRequestClose={() => setPwdUser(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.cardTitle}>Nova senha para @{pwdUser?.username}</Text>
            {pwdUser?.email ? <Text style={styles.muted}>{pwdUser.email}</Text> : null}
            <View style={styles.pwdRow}>
              <TextInput
                value={pwd}
                onChangeText={setPwd}
                placeholder="Mínimo 6 caracteres"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!pwdShow}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                style={styles.pwdInput}
              />
              <Pressable onPress={() => setPwdShow((v) => !v)} hitSlop={8}>
                <Ionicons name={pwdShow ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.textMuted} />
              </Pressable>
            </View>
            <View style={styles.actions}>
              <Pressable style={[styles.btn, { backgroundColor: '#4B5563' }]} onPress={() => setPwdUser(null)}>
                <Text style={styles.btnText}>Cancelar</Text>
              </Pressable>
              <Pressable style={[styles.btn, { backgroundColor: '#2563EB' }]} onPress={savePassword}>
                <Text style={styles.btnText}>Salvar senha</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={styles.grid}>{children}</View>
    </View>
  );
}

function Stat({ label, value, onPress }: { label: string; value: number; onPress?: () => void }) {
  return (
    <Pressable style={styles.stat} onPress={onPress} disabled={!onPress}>
      <Text style={styles.statValue}>{Number(value ?? 0).toLocaleString('pt-BR')}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Pressable>
  );
}

function Bars({ rows }: { rows: { label: string; total: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.total));
  if (!rows.length) return <Text style={styles.muted}>Sem dados.</Text>;
  return (
    <View style={{ gap: 6, marginBottom: spacing.md }}>
      {rows.map((r) => (
        <View key={r.label} style={styles.barRow}>
          <Text style={styles.barLabel}>{r.label}</Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${(r.total / max) * 100}%` }]} />
          </View>
          <Text style={styles.barValue}>{r.total}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  tabs: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  tab: { borderWidth: 1, borderColor: colors.border, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 7 },
  tabOn: { backgroundColor: colors.like, borderColor: colors.like },
  tabText: { color: colors.text, fontWeight: '700' },
  pad: { padding: spacing.md, gap: spacing.md },
  groupTitle: { color: colors.text, fontWeight: '800', fontSize: 15, marginTop: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stat: { flexGrow: 1, flexBasis: '45%', backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, gap: 2 },
  statValue: { color: colors.text, fontSize: 22, fontWeight: '800' },
  statLabel: { color: colors.textMuted, fontSize: 12 },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, gap: 4 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardTitle: { color: colors.text, fontWeight: '700' },
  badge: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  badgeOpen: { color: colors.like },
  body: { color: colors.text, marginTop: 4 },
  muted: { color: colors.textMuted, fontSize: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  btn: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: spacing.lg },
  modalCard: { backgroundColor: colors.surface, borderRadius: 16, padding: spacing.lg, gap: spacing.sm },
  pwdRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12 },
  pwdInput: { flex: 1, color: colors.text, paddingVertical: 10, fontSize: 15 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 12, height: 40 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barLabel: { width: 48, color: colors.textMuted, fontSize: 12 },
  barTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.surface, overflow: 'hidden' },
  barFill: { height: 10, backgroundColor: colors.primary },
  barValue: { width: 36, textAlign: 'right', color: colors.text, fontSize: 12, fontWeight: '700' },
}));
