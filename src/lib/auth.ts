import { NextRequest, NextResponse } from "next/server";

export function validateApiKey(request: NextRequest): boolean {
  // Allow same-origin requests from the web UI (no API key needed)
  const referer = request.headers.get("referer");
  const origin = request.headers.get("origin");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (referer?.startsWith(appUrl) || origin?.startsWith(appUrl)) {
    return true;
  }

  // External requests require API key
  const apiKey = request.headers.get("x-api-key");
  return apiKey === process.env.API_KEY;
}

export function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
