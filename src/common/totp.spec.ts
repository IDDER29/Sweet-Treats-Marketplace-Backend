import { authenticator } from 'otplib';
import { generateTotpSecret, totpKeyUri, verifyTotp } from './totp';

describe('totp', () => {
  it('generates a secret and verifies a fresh code', () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]+$/); // base32
    const code = authenticator.generate(secret);
    expect(verifyTotp(secret, code)).toBe(true);
  });

  it('rejects a wrong code', () => {
    const secret = generateTotpSecret();
    expect(verifyTotp(secret, '000000')).toBe(false);
  });

  it('rejects empty/missing inputs (fail closed)', () => {
    expect(verifyTotp('', '123456')).toBe(false);
    expect(verifyTotp(generateTotpSecret(), '')).toBe(false);
    expect(verifyTotp(null, null)).toBe(false);
  });

  it('builds an otpauth URI with issuer and account', () => {
    const uri = totpKeyUri('admin@test.com', generateTotpSecret());
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(uri).toContain('Sweet%20Treats');
    expect(uri).toContain('secret=');
  });
});
