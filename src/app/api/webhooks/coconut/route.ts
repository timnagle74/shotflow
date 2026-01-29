import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create admin Supabase client for server-side operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUNNY_STORAGE_CDN_URL = process.env.BUNNY_STORAGE_CDN_URL;
const BUNNY_STREAM_LIBRARY_ID = process.env.BUNNY_STREAM_LIBRARY_ID;
const BUNNY_STREAM_API_KEY = process.env.BUNNY_STREAM_API_KEY;

/**
 * POST /api/webhooks/coconut
 * Receives webhook notifications from Coconut when transcoding completes
 * Then tells Bunny Stream to fetch the transcoded video
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const url = new URL(request.url);
    const bunnyVideoId = url.searchParams.get('bunnyVideoId');
    const transcodedPath = url.searchParams.get('transcodedPath');
    
    console.log('Coconut webhook received:', {
      event: body.status,
      jobId: body.id,
      bunnyVideoId,
      transcodedPath,
      body: JSON.stringify(body, null, 2),
    });

    // Check if job completed successfully
    if (body.status === 'job.completed' && bunnyVideoId && transcodedPath) {
      console.log(`Transcode job ${body.id} completed. Triggering Bunny Stream fetch...`);

      // Tell Bunny Stream to fetch the transcoded video
      if (BUNNY_STREAM_LIBRARY_ID && BUNNY_STREAM_API_KEY && BUNNY_STORAGE_CDN_URL) {
        const transcodedUrl = `${BUNNY_STORAGE_CDN_URL}${transcodedPath}`;
        
        console.log('Fetching video into Bunny Stream:', transcodedUrl);

        // Use Bunny Stream's fetch endpoint
        const fetchResponse = await fetch(
          `https://video.bunnycdn.com/library/${BUNNY_STREAM_LIBRARY_ID}/videos/${bunnyVideoId}/fetch`,
          {
            method: 'POST',
            headers: {
              'AccessKey': BUNNY_STREAM_API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url: transcodedUrl,
            }),
          }
        );

        if (fetchResponse.ok) {
          console.log('Bunny Stream fetch initiated successfully');
          
          // Update version record to mark transcoding as complete
          // Find version by bunny_video_id
          const { error: updateError } = await supabaseAdmin
            .from('versions')
            .update({ 
              status: 'WIP', // Keep as WIP, transcoding done
            })
            .eq('bunny_video_id', bunnyVideoId);

          if (updateError) {
            console.error('Failed to update version:', updateError);
          }
        } else {
          const errorText = await fetchResponse.text();
          console.error('Bunny Stream fetch failed:', fetchResponse.status, errorText);
        }
      }
    } else if (body.status === 'job.failed') {
      console.error(`Transcode job ${body.id} failed:`, body.errors);
    }

    // Always return 200 to acknowledge receipt
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Coconut webhook error:', error);
    // Still return 200 to prevent retries
    return NextResponse.json({ received: true, error: 'Processing error' });
  }
}
