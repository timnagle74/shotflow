# ShotFlow Upload Architecture Analysis

## Problem Statement
Bunny Storage does not support presigned URLs for uploads. It requires the AccessKey header, which cannot be exposed to browsers. This prevents direct browser-to-storage uploads.

## Requirements
1. Single upload from vendor's perspective
2. Original file preserved for editorial download (ProRes/EXR/etc.)
3. Web preview generated (HLS streaming)
4. Support for large files (potentially multi-GB VFX deliveries)
5. No Vercel size limits (currently ~4.5MB)

---

## Option A: Cloudflare R2 + Bunny Stream (RECOMMENDED)

**Architecture:**
```
Browser → R2 (presigned PUT) → Original stored
                            ↓
                    Stream Fetch API → Transcodes → Preview
```

**How it works:**
1. Server generates presigned R2 PUT URL
2. Browser uploads directly to R2 (original preserved)
3. After upload, server calls Bunny Stream Fetch API
4. Stream pulls from R2 and transcodes for web preview

**Pros:**
- Single upload from vendor
- Original file preserved in R2
- Preview auto-generated via Stream
- No file size limits
- R2 is S3-compatible (easy migration)
- Very cheap: $0.015/GB storage, $0.36/million requests

**Cons:**
- Adds another service (Cloudflare account)
- Two storage locations (R2 for originals, Stream for previews)

**Implementation effort:** Medium (2-4 hours)

---

## Option B: Bunny Edge Script for Storage

**Architecture:**
```
Browser → Bunny Edge Script (presigned) → Storage
                                       ↓
                               Stream Fetch API → Preview
```

**How it works:**
1. Deploy edge script that validates presigned tokens
2. Edge script proxies upload to Storage with AccessKey
3. After upload, trigger Stream fetch

**Pros:**
- Stays within Bunny ecosystem
- Single upload from vendor

**Cons:**
- Edge script limited to 30s CPU time, 128MB memory
- Tested max ~1GB files (may fail for large VFX)
- More complex setup (edge scripting)
- Bunny recommends Stream+TUS for video, not edge scripts

**Implementation effort:** High (4-8 hours)

---

## Option C: VPS Upload Proxy

**Architecture:**
```
Browser → VPS Proxy → Bunny Storage (AccessKey auth)
                   ↓
           Stream Fetch API → Preview
```

**How it works:**
1. Small VPS runs upload proxy (Node/Go/etc.)
2. Browser uploads to proxy
3. Proxy forwards to Bunny Storage with AccessKey
4. Trigger Stream fetch after

**Pros:**
- No file size limits
- Full control over the process

**Cons:**
- Additional infrastructure to maintain
- VPS costs (~$5-20/month)
- Proxy becomes single point of failure
- Need to handle timeouts, retries, etc.

**Implementation effort:** Medium-High (4-6 hours + ongoing maintenance)

---

## Option D: Dual Upload (Stream + Storage via Vercel)

**Architecture:**
```
Browser → Stream (TUS) → Preview
       ↘
         Vercel API → Storage → Original (small files only)
```

**How it works:**
1. Browser uploads to Stream via TUS (presigned)
2. For files under ~4MB, also upload to Storage via Vercel
3. Large files: only preview available, no original download

**Pros:**
- Works immediately with current setup
- No new services needed

**Cons:**
- Large files can't be downloaded (only transcoded preview)
- Defeats the purpose for editorial workflow
- Not a real solution

**Implementation effort:** Low (already partially done)

---

## Recommendation: Option A (Cloudflare R2)

R2 is the cleanest solution because:
1. S3-compatible presigned URLs (proven, well-documented)
2. No file size limits
3. Extremely cheap storage
4. Can serve downloads directly via R2 public URL or presigned GET
5. Stream's Fetch API can pull from any URL

### Implementation Steps

1. **Create Cloudflare account + R2 bucket**
   - Enable S3-compatible API
   - Configure CORS for browser uploads

2. **Add R2 credentials to ShotFlow**
   ```env
   R2_ACCOUNT_ID=xxx
   R2_ACCESS_KEY_ID=xxx
   R2_SECRET_ACCESS_KEY=xxx
   R2_BUCKET_NAME=shotflow-originals
   R2_PUBLIC_URL=https://xxx.r2.cloudflarestorage.com
   ```

3. **Update prepare-upload API**
   - Generate presigned R2 PUT URL
   - Return to client for direct upload

4. **Update finalize API**
   - Generate R2 presigned GET URL (or public URL)
   - Call Bunny Stream Fetch API with that URL
   - Store R2 path for download generation

5. **Update download API**
   - Generate presigned R2 GET URL for downloads

### Cost Estimate (1TB storage, 1000 uploads/month)
- R2 Storage: $15/month
- R2 Class A ops (writes): ~$0.50/month
- R2 Class B ops (reads): ~$0.04/month
- Bunny Stream: existing cost
- **Total additional: ~$16/month**

---

## Alternative: Keep Bunny-only with compromises

If adding R2 is not desired, accept these limitations:
- Use TUS upload to Stream only
- Original files are transcoded (not preserved)
- Editorial downloads the HLS/MP4 preview, not original ProRes

This is the current broken state but would "work" without original preservation.
