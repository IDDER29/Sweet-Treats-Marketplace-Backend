import { Injectable, BadRequestException } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const PRESIGN_TTL_SECONDS = 300; // 5 minutes

@Injectable()
export class StorageService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly region: string;

  constructor() {
    this.region = process.env.STORAGE_REGION || 'eu-west-1';
    this.bucket = process.env.STORAGE_BUCKET || '';
    // STORAGE_ENDPOINT lets us point at any S3-compatible store (MinIO/R2) for
    // local dev and self-hosting; path-style addressing is required for MinIO.
    const endpoint = process.env.STORAGE_ENDPOINT;
    this.s3 = new S3Client({
      region: this.region,
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
      credentials: {
        accessKeyId: process.env.STORAGE_ACCESS_KEY || '',
        secretAccessKey: process.env.STORAGE_SECRET_KEY || '',
      },
    });
  }

  // Extension is derived from the validated mimetype, never the client-supplied
  // filename, so the object key can't be influenced by a crafted name.
  private buildKey(businessId: string, contentType: string): string {
    const ext = MIME_TO_EXT[contentType];
    if (!ext) {
      throw new BadRequestException(
        'Only JPEG, PNG, and WebP images are allowed',
      );
    }
    return `products/${businessId}/${randomUUID()}.${ext}`;
  }

  private publicUrlFor(key: string): string {
    const cdnBase =
      process.env.STORAGE_CDN_URL ||
      `https://${this.bucket}.s3.${this.region}.amazonaws.com`;
    return `${cdnBase}/${key}`;
  }

  async uploadProductImage(
    file: Express.Multer.File,
    businessId: string,
  ): Promise<{ url: string; key: string; name: string }> {
    if (file.size > MAX_IMAGE_BYTES) {
      throw new BadRequestException('Image must be under 5MB');
    }
    const key = this.buildKey(businessId, file.mimetype);

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        CacheControl: 'max-age=31536000',
      }),
    );

    return { url: this.publicUrlFor(key), key, name: file.originalname };
  }

  /**
   * Issue a short-lived presigned PUT URL so the client uploads the bytes
   * straight to S3 (the API never proxies the image). The client must PUT with
   * the same `Content-Type` header, and the object key is minted server-side so
   * it always lands under this business's prefix. After a successful upload the
   * client references the returned `key`/`publicUrl` when saving the product.
   */
  async createPresignedUpload(
    businessId: string,
    contentType: string,
  ): Promise<{
    uploadUrl: string;
    key: string;
    publicUrl: string;
    expiresIn: number;
    contentType: string;
  }> {
    const key = this.buildKey(businessId, contentType);
    const uploadUrl = await getSignedUrl(
      this.s3,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
      }),
      { expiresIn: PRESIGN_TTL_SECONDS },
    );
    return {
      uploadUrl,
      key,
      publicUrl: this.publicUrlFor(key),
      expiresIn: PRESIGN_TTL_SECONDS,
      contentType,
    };
  }

  async deleteObject(key: string): Promise<void> {
    if (!key || !this.bucket) return;
    await this.s3.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
