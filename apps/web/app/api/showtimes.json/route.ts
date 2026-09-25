import { NextResponse } from "next/server";
import { getShowtimes, MAX_DAYS } from "@/lib/data";
import { VANCOUVER_TZ } from "@/lib/format";

/** Upcoming showtimes through the end of the 14th Vancouver day, written at build time. */
export const dynamic = "force-static";

export async function GET() {
  const { data, demo, generatedAt } = await getShowtimes(MAX_DAYS);
  return NextResponse.json({ data, meta: { days: MAX_DAYS, timezone: VANCOUVER_TZ, demo, generatedAt } });
}
