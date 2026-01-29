import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create admin Supabase client for server-side operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/webhooks/coconut
 * Receives webhook notifications from Coconut when transcoding completes
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('Coconut webhook received:', JSON.stringify(body, null, 2));

    // Coconut sends different event types
    const { event, job_id, output_urls, error } = body;

    if (event === 'job.completed') {
      console.log(`Transcode job ${job_id} completed successfully`);
      // The video is now available in Bunny Stream
      // We could update the version record here if needed
    } else if (event === 'job.failed') {
      console.error(`Transcode job ${job_id} failed:`, error);
    } else if (event === 'output.completed') {
      console.log(`Output completed for job ${job_id}:`, output_urls);
    }

    // Always return 200 to acknowledge receipt
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Coconut webhook error:', error);
    // Still return 200 to prevent retries
    return NextResponse.json({ received: true, error: 'Processing error' });
  }
}
