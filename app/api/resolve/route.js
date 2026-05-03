import { NextResponse } from "next/server";
import { resolveEnsOrAddress } from "../../../lib/chain.js";

export const runtime = "nodejs";

export async function POST(request) {
  const body = await request.json();
  const resolved = await resolveEnsOrAddress(
    body.input || "",
    body.fallbackAddress || null,
  );
  return NextResponse.json({ ok: true, resolved });
}
