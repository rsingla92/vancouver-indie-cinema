import { NextResponse } from "next/server";
import { getShowtimes } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data, demo } = await getShowtimes(1);
  return NextResponse.json({ data, meta: { timezone: "America/Vancouver", demo, generatedAt: new Date().toISOString() } }, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" },
  });
}
