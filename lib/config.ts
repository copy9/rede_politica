// Endereço e chave PÚBLICA do projeto Supabase.
// A chave "publishable" é feita para ficar dentro do app: o que protege os dados são as
// regras de segurança (RLS) do banco. NUNCA coloque aqui a chave secreta (sb_secret_...).
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://rqpxnpynkyeocxmjyzav.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_9ORBBumPUrkUHFycGu5_aA_tVIcnDFR';
