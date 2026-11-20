import { describe, expect, it } from 'vitest';
import { formatAuthErrorForUser } from './formatAuthError';
import { existingAccountError } from './signupResult';

describe('existingAccountError', () => {
  it('email que já tem conta (Supabase devolve usuário sem identidades e sem erro): avisa em vez de "verifique o email"', () => {
    const err = existingAccountError({ id: 'x', identities: [] });
    expect(err).not.toBeNull();
    expect(formatAuthErrorForUser(err)).toBe('Já existe uma conta com este email. Tente fazer login ou recuperar a senha.');
  });

  it('cadastro novo (com identidade) segue normal', () => {
    expect(existingAccountError({ id: 'x', identities: [{ id: 'i1' }] })).toBeNull();
    expect(existingAccountError(null)).toBeNull();
  });
});
