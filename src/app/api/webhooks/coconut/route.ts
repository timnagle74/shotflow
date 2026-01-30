import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create admin Supabase client for server-side operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUNNY_STREAM_LIBRARY_ID = process.env.BUNNY_STREAM_LIBRARY_ID;
const BUNNY_STREAM_API_KEY = process.env.BUNNY_STREAM_API_KEY;
const BUNNY_STORAGE_CDN_URL = process.env.BUNNY_STORAGE_CDN_URL;

interface CoconutWebhook {
  id: string;
  status: string;
  progress: string;
  input: {
    status: string;
    error?: string;
  };
  outputs: Array<{
    key: string;
    status: string;
    url?: string;
    error?: string;
  }>;
}

/**
 * Convert FTP output path to CDN URL
 * Coconut returns: ftp://storage.bunnycdn.com/transcoded/filename.mp4
 * We need: https://shotflow-pull.b-cdn.net/transcoded/filename.mp4
 */
function ftpUrlToCdnUrl(ftpUrl: string): string | null {
  if (!BUNNY_STORAGE_CDN_URL) return null;
  
  // Extract path from FTP URL (after storage.bunnycdn.com)
  const match = ftpUrl.match(/storage\.bunnycdn\.com(\/.*)/);
  if (match) {
    return `${BUNNY_STORAGE_CDN_URL}${match[1]}`;
  }
  return null;
}

/**
 * POST /api/webhooks/coconut
 * Receives webhook notifications from Coconut when transcoding completes
 * Then tells Bunny Stream to fetch the transcoded video from Bunny Storage CDN
 */
export async function POST(request: NextRequest) {
  try {
    const body: CoconutWebhook = await request.json();
    const url = new URL(request.url);
    const bunnyVideoId = url.searchParams.get('bunnyVideoId');
    
    console.log('Coconut webhook received:', {
      jobId: body.id,
      status: body.status,
      bunnyVideoId,
    });

    // Check if job completed successfully
    if (body.status === 'job.completed' && bunnyVideoId) {
      // Find the output
      const mp4Output = body.outputs.find(o => o.key === 'mp4:1080p' && o.status === 'video.encoded');
      
      if (mp4Output?.url) {
        // Convert FTP URL to CDN URL for Bunny Stream to fetch
        const cdnUrl = ftpUrlToCdnUrl(mp4Output.url);
        
        if (cdnUrl) {
          console.log(`Transcode complete. Fetching ${cdnUrl} into Bunny Stream...`);

          // Tell Bunny Stream to fetch the transcoded video
          if (BUNNY_STREAM_LIBRARY_ID && BUNNY_STREAM_API_KEY) {
            const fetchResponse = await fetch(
              `https://video.bunnycdn.com/library/${BUNNY_STREAM_LIBRARY_ID}/videos/${bunnyVideoId}/fetch`,
              {
                method: 'POST',
                headers: {
                  'AccessKey': BUNNY_STREAM_API_KEY,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  url: cdnUrl,
                }),
              }
            );

            if (fetchResponse.ok) {
              console.log('Bunny Stream fetch initiated successfully');
            } else {
              const errorText = await fetchResponse.text();
              console.error('Bunny Stream fetch failed:', fetchResponse.status, errorText);
            }
          }
        } else {
          console.error('Could not convert FTP URL to CDN URL:', mp4Output.url);
        }
      } else {
        console.error('No output URL found in completed job');
      }
    } else if (body.status === 'job.failed') {
      console.error(`Transcode job ${body.id} failed:`, body.input.error || body.outputs.map(o => o.error).join(', '));
    }

    // Always return 200 to acknowledge receipt
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Coconut webhook error:', error);
    // Still return 200 to prevent retries
    return NextResponse.json({ received: true, error: 'Processing error' });
  }
}
