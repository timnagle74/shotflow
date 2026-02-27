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

### Why Direct Upload?

**Problem:** Vercel serverless functions have a **4.5MB request body limit**. VFX files are typically 100MB - 10GB+.

**Solution:** Generate signed URLs server-side, upload directly from browser to Bunny CDN. The Vercel function only handles:
- Authentication (verify user is logged in)
- URL signing (generate time-limited upload URL)
- Database records (after upload completes)

### Signed URL Security

Signed URLs use SHA256 HMAC with:
- Storage API password (never exposed to client)
- File path
- Expiration timestamp (2 hours for large files)

The browser gets a pre-signed URL like:
```
https://storage.bunnycdn.com/zone/path/file.mov?token=abc123&expires=1234567890
```

This URL:
- ✅ Works for PUT requests (upload)
- ✅ Expires after 2 hours
- ✅ Only valid for the specific path
- ❌ Cannot be reused after expiry
- ❌ Cannot be used for different paths

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
