import { translateAnnouncement } from "@/lib/announcements/translateRoute.server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(request: Request) { return translateAnnouncement(request, true); }
