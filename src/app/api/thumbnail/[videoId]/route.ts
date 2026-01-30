import { NextRequest, NextResponse } from 'next/server';

const BUNNY_STREAM_CDN = process.env.NEXT_PUBLIC_BUNNY_STREAM_CDN || 'https://vz-3b0f7864-a89.b-cdn.net';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const { videoId } = await params;
  
  if (!videoId) {
    return NextResponse.json({ error: 'Missing videoId' }, { status: 400 });
  }

  try {
    const thumbnailUrl = `${BUNNY_STREAM_CDN}/${videoId}/thumbnail.jpg`;
    
    const response = await fetch(thumbnailUrl, {
      headers: {
        'Accept': 'image/jpeg,image/png,image/*',
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Thumbnail not found' }, { status: 404 });
    }

    const imageBuffer = await response.arrayBuffer();
    
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Thumbnail fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch thumbnail' }, { status: 500 });
  }
}
