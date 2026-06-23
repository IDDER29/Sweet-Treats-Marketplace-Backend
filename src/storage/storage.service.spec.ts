import { BadRequestException } from '@nestjs/common';
import { StorageService } from './storage.service';

// Presigning is a local SigV4 computation (no network), so these assertions run
// against the real signer with dummy credentials.
describe('StorageService — presigned uploads', () => {
  const ORIGINAL_ENV = process.env;

  beforeAll(() => {
    process.env = {
      ...ORIGINAL_ENV,
      STORAGE_REGION: 'us-east-1',
      STORAGE_BUCKET: 'sweet-treats',
      STORAGE_ACCESS_KEY: 'test-access-key',
      STORAGE_SECRET_KEY: 'test-secret-key',
      STORAGE_CDN_URL: 'https://cdn.example.com/sweet-treats',
    };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('mints a short-lived presigned PUT URL with a server-side key', async () => {
    const svc = new StorageService();
    const res = await svc.createPresignedUpload('biz-1', 'image/png');

    // Key is minted under the business prefix with the mimetype-derived ext.
    expect(res.key).toMatch(/^products\/biz-1\/[0-9a-f-]+\.png$/);
    // A real signed URL: https, carries the key, and SigV4 query params.
    expect(res.uploadUrl).toMatch(/^https:\/\//);
    expect(res.uploadUrl).toContain(res.key);
    expect(res.uploadUrl).toContain('X-Amz-Signature=');
    expect(res.uploadUrl).toContain('X-Amz-Expires=300');
    // Public URL uses the CDN base, not the signed endpoint.
    expect(res.publicUrl).toBe(
      `https://cdn.example.com/sweet-treats/${res.key}`,
    );
    expect(res.expiresIn).toBe(300);
    expect(res.contentType).toBe('image/png');
  });

  it('derives the extension from the mimetype (jpeg -> jpg)', async () => {
    const svc = new StorageService();
    const res = await svc.createPresignedUpload('biz-2', 'image/jpeg');
    expect(res.key).toMatch(/\.jpg$/);
  });

  it('rejects a disallowed content type', async () => {
    const svc = new StorageService();
    await expect(
      svc.createPresignedUpload('biz-1', 'application/pdf'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps each minted key unique', async () => {
    const svc = new StorageService();
    const a = await svc.createPresignedUpload('biz-1', 'image/webp');
    const b = await svc.createPresignedUpload('biz-1', 'image/webp');
    expect(a.key).not.toBe(b.key);
  });
});
