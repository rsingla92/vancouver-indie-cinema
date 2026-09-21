import { NextRequest, NextResponse } from "next/server";
import { getShowtimes } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const rawDays = Number(request.nextUrl.searchParams.get("days") ?? 7);
  const days = Math.min(14, Math.max(1, Number.isFinite(rawDays) ? rawDays : 7));
  const { data, demo } = await getShowtimes(days);
  return NextResponse.json({ data, meta: { days, demo, generatedAt: new Date().toISOString() } });
}
