import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { TranslationResponse, TranslationResponseSchema } from '@learneng/shared';

export class R2StorageService {
  public s3: S3Client;
  private bucketName: string;

  constructor(s3Client?: S3Client) {
    const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID || 'test-account';
    this.bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'learneng-cache';

    this.s3 =
      s3Client ||
      new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || 'test-access-key',
          secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || 'test-secret-key',
        },
      });
  }

  /**
   * Saves translation payload to Cloudflare R2 root bucket at /{hash}.json
   */
  async saveTranslationToRoot(hash: string, payload: TranslationResponse): Promise<void> {
    const validatedPayload = TranslationResponseSchema.parse(payload);
    const key = `${hash}.json`; // Root bucket key (no subfolder prefix)
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: JSON.stringify(validatedPayload),
        ContentType: 'application/json; charset=utf-8',
        CacheControl: 'public, max-age=31536000, immutable',
      })
    );
  }
}
