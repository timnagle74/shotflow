/**
 * S3-compatible Storage for ShotFlow (MinIO via Cloudflare Tunnel)
 * Used for original file uploads/downloads with presigned URLs
 */

import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Configuration from environment
const s3Config = {
  endpoint: process.env.S3_ENDPOINT || '',
  accessKeyId: process.env.S3_ACCESS_KEY || '',
  secretAccessKey: process.env.S3_SECRET_KEY || '',
  bucket: process.env.S3_BUCKET || 'vendor-transfers',
  region: process.env.S3_REGION || 'us-east-1',
};

// Create S3 client (works with MinIO, R2, AWS S3, etc.)
let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    if (!s3Config.endpoint || !s3Config.accessKeyId || !s3Config.secretAccessKey) {
      throw new Error('S3 configuration not set - check S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY');
    }
    
    s3Client = new S3Client({
      endpoint: s3Config.endpoint,
      region: s3Config.region,
      credentials: {
        accessKeyId: s3Config.accessKeyId,
        secretAccessKey: s3Config.secretAccessKey,
      },
      forcePathStyle: true, // Required for MinIO
    });
  }
  return s3Client;
}

/**
 * Check if S3 storage is configured
 */
export function isS3Configured(): boolean {
  return !!(s3Config.endpoint && s3Config.accessKeyId && s3Config.secretAccessKey);
}

/**
 * Generate a presigned URL for uploading a file
 */
export async function getPresignedUploadUrl(
  key: string,
  contentType: string = 'application/octet-stream',
  expiresIn: number = 7200 // 2 hours
): Promise<{ url: string; key: string }> {
  const client = getS3Client();
  
  const command = new PutObjectCommand({
    Bucket: s3Config.bucket,
    Key: key,
    ContentType: contentType,
  });

  const url = await getSignedUrl(client, command, { expiresIn });
  
  return { url, key };
}

/**
 * Generate a presigned URL for downloading a file
 */
export async function getPresignedDownloadUrl(
  key: string,
  expiresIn: number = 3600, // 1 hour
  filename?: string
): Promise<string> {
  const client = getS3Client();
  
  const command = new GetObjectCommand({
    Bucket: s3Config.bucket,
    Key: key,
    ...(filename && { ResponseContentDisposition: `attachment; filename="${filename}"` }),
  });

  return getSignedUrl(client, command, { expiresIn });
}

/**
 * Check if a file exists in S3
 */
export async function fileExists(key: string): Promise<boolean> {
  const client = getS3Client();
  
  try {
    await client.send(new HeadObjectCommand({
      Bucket: s3Config.bucket,
      Key: key,
    }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the public URL for a file (if bucket is public)
 * For private buckets, use getPresignedDownloadUrl instead
 */
export function getPublicUrl(key: string): string {
  return `${s3Config.endpoint}/${s3Config.bucket}/${key}`;
}

/**
 * Generate storage key for a version file
 */
export function getVersionStorageKey(
  projectCode: string,
  shotCode: string,
  versionNumber: number,
  filename: string
): string {
  const versionStr = `v${String(versionNumber).padStart(3, '0')}`;
  const ext = filename.split('.').pop() || 'mov';
  return `${projectCode}/${shotCode}/${versionStr}/${shotCode}_${versionStr}.${ext}`;
}
