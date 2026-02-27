# ShotFlow Upload Architecture

## Overview

ShotFlow uses [Bunny.net](https://bunny.net) for file storage and video streaming:

- **Bunny Storage** - ProRes/source files for download
- **Bunny Stream** - H.264/H.265 transcoded files for web playback (HLS)

## Upload Flow

### Version Uploads (VFX Comps)

```
┌─────────────┐     1. Request signed URL      ┌─────────────────────┐
│   Browser   │ ──────────────────────────────▶│  /api/versions/     │
│             │                                │  prepare-upload     │
│             │◀────────────────────────────── │                     │
│             │     2. Signed URL + metadata   └─────────────────────┘
│             │
│             │     3. PUT file directly       ┌─────────────────────┐
│             │ ──────────────────────────────▶│   Bunny Storage     │
│             │                                │   (CDN)             │
│             │◀────────────────────────────── │                     │
│             │     4. 201 Created             └─────────────────────┘
│             │
│             │     5. Create DB record        ┌─────────────────────┐
│             │ ──────────────────────────────▶│  /api/versions/     │
│             │                                │  finalize           │
│             │◀────────────────────────────── │                     │
└─────────────┘     6. Version created         └─────────────────────┘
                                                        │
                                                        ▼
                                               ┌─────────────────────┐
                                               │  Coconut.co         │
                                               │  (transcoding)      │
                                               └─────────────────────┘
```

### Why Streaming Proxy?

**Problem:** Vercel serverless functions have a **4.5MB request body limit**. VFX files are typically 100MB - 10GB+.

**Problem #2:** Bunny Storage requires `AccessKey` header authentication, which can't be exposed to browsers (signed URLs only work for downloads, not uploads).

**Solution:** Use Vercel Edge Runtime with streaming proxy:
- Edge functions can stream request bodies without buffering
- Server-side auth (AccessKey added by proxy, never exposed to client)
- No file size limits (streaming, not buffering)

### Streaming Proxy Architecture

The proxy route (`/api/versions/upload-proxy`) runs on Edge runtime and:
1. Authenticates the user (session cookie)
2. Streams request body directly to Bunny Storage
3. Adds `AccessKey` header server-side
4. Never buffers the full file in memory

## File Types

### Supported Upload Formats
- `.mov` - ProRes, DNxHD
- `.mxf` - MXF containers
- `.mp4` / `.m4v` - H.264/H.265

### Transcoding
After upload, files are automatically transcoded via Coconut.co to:
- H.264 web preview (HLS streaming)
- Thumbnail generation

Transcoding takes ~1-2 minutes depending on file size.

## Environment Variables

```bash
# Bunny Storage (for downloads/source files)
BUNNY_STORAGE_ZONE=your-zone-name
BUNNY_STORAGE_HOSTNAME=storage.bunnycdn.com
BUNNY_STORAGE_PASSWORD=your-api-key
BUNNY_STORAGE_CDN_URL=https://your-zone.b-cdn.net

# Bunny Stream (for web playback)
BUNNY_STREAM_LIBRARY_ID=12345
BUNNY_STREAM_API_KEY=your-stream-key
NEXT_PUBLIC_BUNNY_STREAM_CDN=https://vz-abc123.b-cdn.net
```

## Troubleshooting

### "413 Request Entity Too Large"
This error means the upload is going through Vercel instead of direct to Bunny. Check:
1. `prepare-upload` returns `useProxy: false`
2. Upload URL starts with `https://storage.bunnycdn.com` (not `/api/`)

### "Upload failed" with CORS error
Bunny Storage requires specific CORS headers. Ensure your Bunny zone has CORS enabled for your domain.

### Upload stuck at 0%
Check browser console for network errors. Common causes:
- Bunny Storage zone not configured
- Signed URL expired (try again)
- Network connectivity issues

## Related Files

- `src/lib/bunny.ts` - Bunny SDK and signed URL generation
- `src/app/api/versions/prepare-upload/route.ts` - Generate upload URLs
- `src/app/api/versions/finalize/route.ts` - Create DB record after upload
- `src/components/version-upload.tsx` - Upload UI component
