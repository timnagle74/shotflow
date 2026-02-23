import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, getServiceClient } from '@/lib/auth';
import { bunnyConfig, generateSignedStorageUrl } from '@/lib/bunny';
import archiver from 'archiver';

/**
 * GET /api/turnovers/[id]/download-plates
 * Generate a ZIP file containing all plates for a turnover
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Auth check
    const auth = await authenticateRequest(request);
    if (auth.error) return auth.error;

    const { id } = params;
    const supabaseAdmin = getServiceClient();

    // Get turnover with project info
    const { data: turnover, error: turnoverError } = await supabaseAdmin
      .from('turnovers')
      .select(`
        id,
        name,
        sequence:sequences!inner(
          code,
          project:projects!inner(code)
        )
      `)
      .eq('id', id)
      .single();

    if (turnoverError || !turnover) {
      return NextResponse.json(
        { error: 'Turnover not found' },
        { status: 404 }
      );
    }

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

    // Create a map of shot_id to shot code for folder organization
    const shotCodeMap = new Map<string, string>();
    turnoverShots.forEach((ts: any) => {
      shotCodeMap.set(ts.shot.id, ts.shot.code);
    });

    // Build ZIP filename
    const projectCode = (turnover.sequence as any).project.code;
    const sequenceCode = (turnover.sequence as any).code;
    const zipFilename = `${projectCode}_${sequenceCode}_${turnover.name}_plates.zip`;

    // Create archive
    const archive = archiver('zip', {
      zlib: { level: 5 } // Balanced compression
    });

    // Set up response headers for streaming ZIP
    const headers = new Headers();
    headers.set('Content-Type', 'application/zip');
    headers.set('Content-Disposition', `attachment; filename="${zipFilename}"`);

    // Create a TransformStream to pipe archive to response
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    // Pipe archive to writer
    archive.on('data', (chunk) => writer.write(chunk));
    archive.on('end', () => writer.close());
    archive.on('error', (err) => {
      console.error('Archive error:', err);
      writer.abort(err);
    });

    // Process plates in the background
    (async () => {
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
            console.warn(`Plate ${plate.id} has no storage_path or cdn_url, skipping`);
            continue;
          }

          const response = await fetch(fileUrl);
          if (!response.ok) {
            console.warn(`Failed to fetch plate ${plate.filename}: ${response.status}`);
            continue;
          }

          const buffer = await response.arrayBuffer();
          
          // Add to archive with folder structure: shotCode/filename
          archive.append(Buffer.from(buffer), {
            name: `${shotCode}/${plate.filename}`
          });
        } catch (err) {
          console.error(`Error processing plate ${plate.filename}:`, err);
          // Continue with other plates
        }
      }

      // Finalize archive
      await archive.finalize();
    })();

    return new Response(readable, { headers });
  } catch (error) {
    console.error('Download plates error:', error);
    return NextResponse.json(
      { error: 'Failed to generate download' },
      { status: 500 }
    );
  }
}
