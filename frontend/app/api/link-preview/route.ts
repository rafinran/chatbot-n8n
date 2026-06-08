import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "Missing url param" }, { status: 400 });
  }

  try {
    // Validate URL
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ChatsonBot/1.0)" },
      signal: AbortSignal.timeout(5000), // 5s timeout
    });

    const html = await res.text();

    // Parse OG tags with regex (no extra dependencies needed)
    const getMeta = (property: string): string | undefined => {
      const match =
        html.match(new RegExp(`<meta[^>]+property=["']og:${property}["'][^>]+content=["']([^"']+)["']`, "i")) ||
        html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${property}["']`, "i"));
      return match?.[1];
    };

    const getMetaName = (name: string): string | undefined => {
      const match =
        html.match(new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, "i")) ||
        html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, "i"));
      return match?.[1];
    };

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);

    const title =
      getMeta("title") ||
      getMetaName("twitter:title") ||
      titleMatch?.[1]?.trim();

    const image =
      getMeta("image") ||
      getMetaName("twitter:image");

    const siteName =
      getMeta("site_name") ||
      parsed.hostname.replace("www.", "");

    return NextResponse.json({ title, image, siteName });
  } catch {
    return NextResponse.json({ error: "Failed to fetch metadata" }, { status: 500 });
  }
}
