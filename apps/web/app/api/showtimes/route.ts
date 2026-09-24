import { NextRequest, NextResponse } from "next/server";
import { clampDays, getShowtimes } from "@/lib/data";
import { VANCOUVER_TZ } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const days = clampDays(request.nextUrl.searchParams.get("days"));
  const { data, demo, generatedAt } = await getShowtimes(days);
  return NextResponse.json(
    { data, meta: { days, timezone: VANCOUVER_TZ, demo, generatedAt } },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } },
  );
}
