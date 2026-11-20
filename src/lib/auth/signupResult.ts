/**
 * Com confirmação de email ligada, o Supabase não dá erro ao cadastrar um email que já tem conta (para
 * não revelar quem é usuário): devolve um usuário sem identidades e não manda email nenhum. Sem esta
 * checagem, o app dizia "Conta criada! Verifique o seu email" e a pessoa esperava um email que não vem.
 */
type SignupUser = { id?: string; identities?: unknown[] | null } | null | undefined;

export function existingAccountError(user: SignupUser): (Error & { code: string }) | null {
  if (!user || !Array.isArray(user.identities) || user.identities.length > 0) return null;
  return Object.assign(new Error('User already registered'), { code: 'user_already_exists' });
}
