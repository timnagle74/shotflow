import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, getServiceClient } from '@/lib/auth';
import { generateSignedStorageUrl } from '@/lib/bunny';
import archiver from 'archiver';
import { PassThrough } from 'stream';

// Increase timeout for large downloads
export const maxDuration = 60;

/**
 * GET /api/turnovers/[id]/download-plates
 * Generate a ZIP file containing all plates for a turnover
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth check
    const auth = await authenticateRequest(request);
    if (auth.error) return auth.error;

    const { id } = await params;
    const supabaseAdmin = getServiceClient();

    // Get turnover with project info
    const { data: turnover, error: turnoverError } = await supabaseAdmin
      .from('turnovers')
      .select(`
        id,
        title,
        turnover_number,
        project:projects(code),
        sequence:sequences(code)
      `)
      .eq('id', id)
      .single();

    if (turnoverError || !turnover) {
      console.error('[download-plates] Turnover not found:', turnoverError);
      return NextResponse.json(
        { error: 'Turnover not found' },
        { status: 404 }
      );
    }
    
    // Get project code
    const projectCode = (turnover.project as any)?.code || 'PROJECT';

    // Get all shots in this turnover
    const { data: turnoverShots, error: shotsError } = await supabaseAdmin
      .from('turnover_shots')
      .select(`
        id,
        shot:shots!inner(
          id,
          code
        )
      `)
      .eq('turnover_id', id);

    if (shotsError) {
      console.error('[download-plates] Failed to fetch shots:', shotsError);
      return NextResponse.json(
        { error: 'Failed to fetch turnover shots' },
        { status: 500 }
      );
    }

    if (!turnoverShots || turnoverShots.length === 0) {
      return NextResponse.json(
        { error: 'No shots in this turnover' },
        { status: 404 }
      );
    }

    // Get shot IDs
    const shotIds = turnoverShots.map((ts: any) => ts.shot.id);

    // Get all plates for these shots
    const { data: plates, error: platesError } = await supabaseAdmin
      .from('shot_plates')
      .select('id, shot_id, filename, storage_path, cdn_url')
      .in('shot_id', shotIds)
      .order('shot_id')
      .order('sort_order');

    if (platesError) {
      console.error('[download-plates] Failed to fetch plates:', platesError);
      return NextResponse.json(
        { error: 'Failed to fetch plates' },
        { status: 500 }
      );
    }

    if (!plates || plates.length === 0) {
      return NextResponse.json(
        { error: 'No plates found for this turnover' },
        { status: 404 }
      );
    }

    console.log(`[download-plates] Processing ${plates.length} plates for turnover ${id}`);

    // Create a map of shot_id to shot code for folder organization
    const shotCodeMap = new Map<string, string>();
    turnoverShots.forEach((ts: any) => {
      shotCodeMap.set(ts.shot.id, ts.shot.code);
    });

    // Build ZIP filename
    const toNumber = turnover.turnover_number || 1;
    const zipFilename = `${projectCode}_TO${toNumber}_plates.zip`;

    // Create archive with buffer collection
    const archive = archiver('zip', {
      zlib: { level: 5 }
    });

    const chunks: Buffer[] = [];
    const passThrough = new PassThrough();
    
    passThrough.on('data', (chunk) => chunks.push(chunk));
    archive.pipe(passThrough);

    // Download and add each plate
    for (const plate of plates) {
      try {
        const shotCode = shotCodeMap.get(plate.shot_id) || 'unknown';
        
        // Generate signed URL and fetch the file
        let fileUrl: string;
        if (plate.storage_path) {
          fileUrl = generateSignedStorageUrl(plate.storage_path, {
            expiresIn: 300,
            directDownload: true,
          });
        } else if (plate.cdn_url) {
          fileUrl = plate.cdn_url;
        } else {
          console.warn(`[download-plates] Plate ${plate.id} has no URL, skipping`);
          continue;
        }

        console.log(`[download-plates] Fetching ${plate.filename}...`);
        const response = await fetch(fileUrl);
        
        if (!response.ok) {
          console.warn(`[download-plates] Failed to fetch ${plate.filename}: ${response.status}`);
          continue;
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        
        // Add to archive with folder structure: shotCode/filename
        archive.append(buffer, {
          name: `${shotCode}/${plate.filename}`
        });
        
        console.log(`[download-plates] Added ${shotCode}/${plate.filename} (${buffer.length} bytes)`);
      } catch (err) {
        console.error(`[download-plates] Error processing ${plate.filename}:`, err);
        // Continue with other plates
      }
    }

    // Finalize and wait for completion
    await archive.finalize();
    
    // Wait for all chunks to be collected
    await new Promise<void>((resolve) => {
      passThrough.on('end', resolve);
    });

    const zipBuffer = Buffer.concat(chunks);
    console.log(`[download-plates] ZIP created: ${zipBuffer.length} bytes`);

    // Return the ZIP file
    return new Response(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipFilename}"`,
        'Content-Length': zipBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('[download-plates] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to generate download' },
      { status: 500 }
    );
  }
}
