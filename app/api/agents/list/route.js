import { NextResponse } from "next/server";
import { readRuntimeState } from "../../../../lib/runtime-store.js";

export const runtime = "nodejs";

export async function GET() {
  const state = await readRuntimeState();
  return NextResponse.json({ ok: true, agents: state.agents });
}
