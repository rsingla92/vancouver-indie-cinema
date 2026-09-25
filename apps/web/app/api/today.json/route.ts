import { NextResponse } from "next/server";
import { getShowtimes } from "@/lib/data";
import { VANCOUVER_TZ } from "@/lib/format";

/** Showtimes for the rest of the build day, Vancouver time. */
export const dynamic = "force-static";

export async function GET() {
  const { data, demo, generatedAt } = await getShowtimes(1);
  return NextResponse.json({ data, meta: { days: 1, timezone: VANCOUVER_TZ, demo, generatedAt } });
}
