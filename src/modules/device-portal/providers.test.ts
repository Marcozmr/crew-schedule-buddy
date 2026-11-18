import { describe, expect, it } from 'vitest';
import { LATAM_IFLIGHT, hostKind } from './providers';

describe('hostKind (LATAM iFlight)', () => {
  it('reconhece o login do Google', () => {
    expect(hostKind(LATAM_IFLIGHT, 'https://accounts.google.com/v3/signin')).toBe('login');
  });

  it('reconhece o login da Microsoft', () => {
    expect(hostKind(LATAM_IFLIGHT, 'https://login.microsoftonline.com/common/saml2')).toBe('login');
  });

  it('reconhece o portal do iFlight', () => {
    expect(hostKind(LATAM_IFLIGHT, 'https://iflightla.ibsplc.aero/iflight-crew/web/getMainPage')).toBe('portal');
  });

  it('qualquer outro site é "other"', () => {
    expect(hostKind(LATAM_IFLIGHT, 'https://example.com/')).toBe('other');
  });

  it('URL inválida é "other"', () => {
    expect(hostKind(LATAM_IFLIGHT, 'não é url')).toBe('other');
  });

  it('entra pela URL com companyId=LA', () => {
    expect(LATAM_IFLIGHT.startUrl).toBe('https://iflightla.ibsplc.aero/iflight-crew/web/getMainPage?companyId=LA');
  });
});
