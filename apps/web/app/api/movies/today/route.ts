import { NextResponse } from "next/server";
import { getShowtimes } from "@/lib/data";
import { VANCOUVER_TZ } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Showtimes for the rest of today, Vancouver time. */
export async function GET() {
  const { data, demo, generatedAt } = await getShowtimes(1);
  return NextResponse.json(
    { data, meta: { timezone: VANCOUVER_TZ, demo, generatedAt } },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } },
  );
}
