import { randomBytes } from 'crypto';

/** URL-safe slug: lowercase, non-alphanumerics → single dashes, trimmed. */
export function slugify(input: string): string {
  return (input || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** A short random suffix to disambiguate colliding slugs. */
export function slugSuffix(): string {
  return randomBytes(3).toString('hex');
}
