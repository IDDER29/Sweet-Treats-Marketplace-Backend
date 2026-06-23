import { authenticator } from 'otplib';

const ISSUER = 'Sweet Treats';

/** Generate a new base32 TOTP secret (RFC 6238, authenticator-app compatible). */
export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

/** otpauth:// URI to render as a QR code for Google Authenticator / Authy / 1Password. */
export function totpKeyUri(accountName: string, secret: string): string {
  return authenticator.keyuri(accountName, ISSUER, secret);
}

/** Verify a 6-digit code against the secret (tolerates ±1 time step of clock skew). */
export function verifyTotp(
  secret: string | null | undefined,
  token: string | null | undefined,
): boolean {
  if (!secret || !token) return false;
  try {
    return authenticator.verify({ token, secret });
  } catch {
    return false;
  }
}
