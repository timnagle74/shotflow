import { NextRequest, NextResponse } from 'next/server';

const BUNNY_STREAM_CDN = process.env.NEXT_PUBLIC_BUNNY_STREAM_CDN;

export async function GET(
  request: NextRequest,
  { params }: { params: { videoId: string } }
) {
  const { videoId } = params;
  
  if (!videoId) {
    return NextResponse.json({ error: 'Missing videoId' }, { status: 400 });
  }

  // Validate videoId is a UUID/GUID format (defense-in-depth)
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(videoId)) {
    return NextResponse.json({ error: 'Invalid videoId format' }, { status: 400 });
  }

  if (!BUNNY_STREAM_CDN) {
    return NextResponse.json({ error: 'CDN not configured' }, { status: 500 });
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
