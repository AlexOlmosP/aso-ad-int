import { NextRequest, NextResponse } from "next/server";

/**
 * Serves the HTML wrapper page for Google content.js ad previews.
 * Used as an iframe src instead of srcdoc to avoid cross-origin script restrictions.
 *
 * GET /api/ads/embed?url=<content.js URL>
 */
export async function GET(req: NextRequest) {
  const previewUrl = req.nextUrl.searchParams.get("url");

  if (!previewUrl) {
    return new NextResponse("Missing url parameter", { status: 400 });
  }

  // Only allow gstatic.com content.js URLs for security
  if (!previewUrl.includes("gstatic.com") && !previewUrl.includes("google.com")) {
    return new NextResponse("Invalid URL", { status: 400 });
  }

  let containerId = "ad-container";
  let callback = "cb";

  try {
    const url = new URL(previewUrl);
    containerId = url.searchParams.get("htmlParentId") || "ad-container";
    callback = url.searchParams.get("responseCallback") || "cb";
  } catch {
    // Use defaults
  }

  const html = `<!DOCTYPE html>
<html><head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #18181B;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  #${containerId} {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
</style>
</head>
<body>
  <div id="${containerId}"></div>
  <script>window["${callback}"] = function() {};</script>
  <script src="${previewUrl}"></script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
