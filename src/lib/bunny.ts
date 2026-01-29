/**
 * Bunny.net Integration for ShotFlow
 * 
 * Storage API: ProRes files for download
 * Stream API: H.265/H.264 files for HLS web playback
 */

import crypto from 'crypto';

// ============================================================
// Configuration
// ============================================================

export const bunnyConfig = {
  storage: {
    zone: process.env.BUNNY_STORAGE_ZONE || '',
    hostname: process.env.BUNNY_STORAGE_HOSTNAME || 'storage.bunnycdn.com',
    password: process.env.BUNNY_STORAGE_PASSWORD || '',
    cdnUrl: process.env.BUNNY_STORAGE_CDN_URL || '',
  },
  stream: {
    libraryId: process.env.BUNNY_STREAM_LIBRARY_ID || '',
    apiKey: process.env.BUNNY_STREAM_API_KEY || '',
    cdnHostname: process.env.NEXT_PUBLIC_BUNNY_STREAM_CDN || '',
  },
};

// ============================================================
// Types
// ============================================================

export interface BunnyStorageUploadResult {
  success: boolean;
  path: string;
  cdnUrl: string;
  size: number;
}

export interface BunnyStreamVideo {
  videoId: string;
  guid: string;
  title: string;
  status: number; // 0=created, 1=uploaded, 2=processing, 3=transcoding, 4=finished, 5=error
  length: number;
  thumbnailUrl: string;
  embedUrl: string;
  hlsUrl: string;
}

export interface BunnyStreamUploadResult {
  success: boolean;
  video: BunnyStreamVideo;
}

export interface SignedUrlOptions {
  expiresIn?: number; // seconds, default 3600 (1 hour)
  directDownload?: boolean;
}

// ============================================================
// Bunny Storage API (for ProRes downloads)
// ============================================================

/**
 * Upload a file to Bunny Storage
 */
export async function uploadToStorage(
  fileBuffer: Buffer,
  remotePath: string,
  contentType: string = 'application/octet-stream'
): Promise<BunnyStorageUploadResult> {
  const { zone, hostname, password, cdnUrl } = bunnyConfig.storage;
  
  if (!zone || !password) {
    throw new Error('Bunny Storage credentials not configured');
  }

  // Ensure path starts with /
  const normalizedPath = remotePath.startsWith('/') ? remotePath : `/${remotePath}`;
  const url = `https://${hostname}/${zone}${normalizedPath}`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'AccessKey': password,
      'Content-Type': contentType,
    },
    body: new Uint8Array(fileBuffer),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Bunny Storage upload failed: ${response.status} - ${errorText}`);
  }

  return {
    success: true,
    path: normalizedPath,
    cdnUrl: `${cdnUrl}${normalizedPath}`,
    size: fileBuffer.length,
  };
}

/**
 * Delete a file from Bunny Storage
 */
export async function deleteFromStorage(remotePath: string): Promise<boolean> {
  const { zone, hostname, password } = bunnyConfig.storage;
  
  if (!zone || !password) {
    throw new Error('Bunny Storage credentials not configured');
  }

  const normalizedPath = remotePath.startsWith('/') ? remotePath : `/${remotePath}`;
  const url = `https://${hostname}/${zone}${normalizedPath}`;

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'AccessKey': password,
    },
  });

  return response.ok;
}

/**
 * Generate a signed URL for secure downloads
 * Uses Bunny's token authentication for CDN URLs
 */
export function generateSignedStorageUrl(
  remotePath: string,
  options: SignedUrlOptions = {}
): string {
  const { cdnUrl, password } = bunnyConfig.storage;
  const { expiresIn = 3600, directDownload = false } = options;

  if (!cdnUrl || !password) {
    throw new Error('Bunny Storage credentials not configured');
  }

  const normalizedPath = remotePath.startsWith('/') ? remotePath : `/${remotePath}`;
  const expiry = Math.floor(Date.now() / 1000) + expiresIn;
  
  // Build the signature base (path + security key + expiry)
  const signatureBase = password + normalizedPath + expiry;
  const token = crypto
    .createHash('sha256')
    .update(signatureBase)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  let url = `${cdnUrl}${normalizedPath}?token=${token}&expires=${expiry}`;
  
  if (directDownload) {
    url += '&download=true';
  }

  return url;
}

// ============================================================
// Bunny Stream API (for HLS playback)
// ============================================================

/**
 * Create a new video in Bunny Stream library
 */
export async function createStreamVideo(title: string): Promise<{ videoId: string; guid: string }> {
  const { libraryId, apiKey } = bunnyConfig.stream;

  if (!libraryId || !apiKey) {
    throw new Error('Bunny Stream credentials not configured');
  }

  const response = await fetch(
    `https://video.bunnycdn.com/library/${libraryId}/videos`,
    {
      method: 'POST',
      headers: {
        'AccessKey': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create Bunny Stream video: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return {
    videoId: data.videoId || data.guid,
    guid: data.guid,
  };
}

/**
 * Upload video content to Bunny Stream
 */
export async function uploadToStream(
  videoId: string,
  fileBuffer: Buffer
): Promise<BunnyStreamUploadResult> {
  const { libraryId, apiKey } = bunnyConfig.stream;

  if (!libraryId || !apiKey) {
    throw new Error('Bunny Stream credentials not configured');
  }

  const response = await fetch(
    `https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`,
    {
      method: 'PUT',
      headers: {
        'AccessKey': apiKey,
        'Content-Type': 'application/octet-stream',
      },
      body: new Uint8Array(fileBuffer),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Bunny Stream upload failed: ${response.status} - ${errorText}`);
  }

  // Get video details after upload
  const video = await getStreamVideo(videoId);

  return {
    success: true,
    video,
  };
}

/**
 * Get video details from Bunny Stream
 */
export async function getStreamVideo(videoId: string): Promise<BunnyStreamVideo> {
  const { libraryId, apiKey, cdnHostname } = bunnyConfig.stream;

  if (!libraryId || !apiKey) {
    throw new Error('Bunny Stream credentials not configured');
  }

  const response = await fetch(
    `https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`,
    {
      headers: {
        'AccessKey': apiKey,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get Bunny Stream video: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  
  return {
    videoId: data.guid,
    guid: data.guid,
    title: data.title,
    status: data.status,
    length: data.length || 0,
    thumbnailUrl: `${cdnHostname}/${data.guid}/thumbnail.jpg`,
    embedUrl: `https://iframe.mediadelivery.net/embed/${libraryId}/${data.guid}`,
    hlsUrl: `${cdnHostname}/${data.guid}/playlist.m3u8`,
  };
}

/**
 * Delete a video from Bunny Stream
 */
export async function deleteFromStream(videoId: string): Promise<boolean> {
  const { libraryId, apiKey } = bunnyConfig.stream;

  if (!libraryId || !apiKey) {
    throw new Error('Bunny Stream credentials not configured');
  }

  const response = await fetch(
    `https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`,
    {
      method: 'DELETE',
      headers: {
        'AccessKey': apiKey,
      },
    }
  );

  return response.ok;
}

/**
 * Get the HLS playback URL for a video
 */
export function getStreamPlaybackUrl(videoId: string): string {
  const { cdnHostname } = bunnyConfig.stream;
  return `${cdnHostname}/${videoId}/playlist.m3u8`;
}

/**
 * Get the embed URL for a video
 */
export function getStreamEmbedUrl(videoId: string): string {
  const { libraryId } = bunnyConfig.stream;
  return `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}`;
}

/**
 * Get video thumbnail URL
 */
export function getStreamThumbnailUrl(videoId: string): string {
  const { cdnHostname } = bunnyConfig.stream;
  return `${cdnHostname}/${videoId}/thumbnail.jpg`;
}

// ============================================================
// Combined Upload (Storage + Stream)
// ============================================================

export interface VersionUploadResult {
  previewVideoId?: string;
  previewUrl?: string;
  downloadPath?: string;
  downloadUrl?: string;
  thumbnailUrl?: string;
}

/**
 * Upload version files to Bunny.net
 * - ProRes → Storage for download
 * - H.265/H.264 → Stream for web playback
 */
export async function uploadVersionFiles(
  projectCode: string,
  shotCode: string,
  versionNumber: number,
  files: {
    proresFile?: Buffer;
    proresFilename?: string;
    previewFile?: Buffer;
    previewFilename?: string;
  }
): Promise<VersionUploadResult> {
  const result: VersionUploadResult = {};
  const versionStr = `v${String(versionNumber).padStart(3, '0')}`;
  const basePath = `/${projectCode}/${shotCode}/${versionStr}`;

  // Upload ProRes to Storage
  if (files.proresFile && files.proresFilename) {
    const ext = files.proresFilename.split('.').pop() || 'mov';
    const storagePath = `${basePath}/${shotCode}_${versionStr}.${ext}`;
    
    const storageResult = await uploadToStorage(
      files.proresFile,
      storagePath,
      'video/quicktime'
    );
    
    result.downloadPath = storageResult.path;
    result.downloadUrl = storageResult.cdnUrl;
  }

  // Upload preview to Stream
  if (files.previewFile && files.previewFilename) {
    const title = `${projectCode}_${shotCode}_${versionStr}`;
    
    // Create video entry
    const { videoId, guid } = await createStreamVideo(title);
    
    // Upload the file
    const streamResult = await uploadToStream(guid, files.previewFile);
    
    result.previewVideoId = streamResult.video.videoId;
    result.previewUrl = streamResult.video.hlsUrl;
    result.thumbnailUrl = streamResult.video.thumbnailUrl;
  }

  return result;
}

// ============================================================
// Helpers
// ============================================================

/**
 * Check if Bunny Storage is configured
 */
export function isStorageConfigured(): boolean {
  return !!(bunnyConfig.storage.zone && bunnyConfig.storage.password);
}

/**
 * Check if Bunny Stream is configured
 */
export function isStreamConfigured(): boolean {
  return !!(bunnyConfig.stream.libraryId && bunnyConfig.stream.apiKey);
}

/**
 * Video status enum matching Bunny's API
 */
export const VideoStatus = {
  CREATED: 0,
  UPLOADED: 1,
  PROCESSING: 2,
  TRANSCODING: 3,
  FINISHED: 4,
  ERROR: 5,
  CAPTIONS_PENDING: 6,
} as const;

/**
 * Get human-readable status label
 */
export function getVideoStatusLabel(status: number): string {
  switch (status) {
    case VideoStatus.CREATED:
      return 'Created';
    case VideoStatus.UPLOADED:
      return 'Uploaded';
    case VideoStatus.PROCESSING:
      return 'Processing';
    case VideoStatus.TRANSCODING:
      return 'Transcoding';
    case VideoStatus.FINISHED:
      return 'Ready';
    case VideoStatus.ERROR:
      return 'Error';
    default:
      return 'Unknown';
  }
}
