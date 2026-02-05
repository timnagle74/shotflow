import { NextRequest, NextResponse } from "next/server";

const BUNNY_STREAM_LIBRARY_ID = process.env.BUNNY_STREAM_LIBRARY_ID;
const BUNNY_STREAM_API_KEY = process.env.BUNNY_STREAM_API_KEY;

// GET /api/thumbnail?videoId=xxx
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const videoId = searchParams.get("videoId");

  if (!videoId || !BUNNY_STREAM_LIBRARY_ID || !BUNNY_STREAM_API_KEY) {
    return new NextResponse("Missing params", { status: 400 });
  }

  try {
    // Fetch thumbnail from Bunny Stream API
    const response = await fetch(
      `https://video.bunnycdn.com/library/${BUNNY_STREAM_LIBRARY_ID}/videos/${videoId}/thumbnail.jpg`,
      {
        headers: {
          AccessKey: BUNNY_STREAM_API_KEY,
        },
      }
    );

    if (!response.ok) {
      // Try alternate URL pattern
      const altResponse = await fetch(
        `https://vz-3b0f7864-a89.b-cdn.net/${videoId}/thumbnail.jpg`,
        {
          headers: {
            Referer: "https://shotflow-eight.vercel.app",
          },
        }
      );
      
      if (!altResponse.ok) {
        return new NextResponse("Thumbnail not found", { status: 404 });
      }
      
      const buffer = await altResponse.arrayBuffer();
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "public, max-age=86400",
        },
      });
    }

    const buffer = await response.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error) {
    console.error("Thumbnail fetch error:", error);
    return new NextResponse("Error fetching thumbnail", { status: 500 });
  }
}
