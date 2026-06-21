import { Injectable, BadRequestException } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

@Injectable()
export class StorageService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly region: string;

  constructor() {
    this.region = process.env.STORAGE_REGION || 'eu-west-1';
    this.bucket = process.env.STORAGE_BUCKET || '';
    this.s3 = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: process.env.STORAGE_ACCESS_KEY || '',
        secretAccessKey: process.env.STORAGE_SECRET_KEY || '',
      },
    });
  }

  async uploadProductImage(
    file: Express.Multer.File,
    businessId: string,
  ): Promise<{ url: string; key: string; name: string }> {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Only JPEG, PNG, and WebP images are allowed',
      );
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('Image must be under 5MB');
    }

    const ext = file.originalname.split('.').pop()?.toLowerCase() || 'jpg';
    const key = `products/${businessId}/${randomUUID()}.${ext}`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        CacheControl: 'max-age=31536000',
      }),
    );

    const cdnBase =
      process.env.STORAGE_CDN_URL ||
      `https://${this.bucket}.s3.${this.region}.amazonaws.com`;
    const url = `${cdnBase}/${key}`;

    return { url, key, name: file.originalname };
  }

  async deleteObject(key: string): Promise<void> {
    if (!key || !this.bucket) return;
    await this.s3.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
