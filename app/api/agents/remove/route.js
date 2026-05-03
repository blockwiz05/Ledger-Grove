import { NextResponse } from "next/server";
import { updateRuntimeState } from "../../../../lib/runtime-store.js";

export const runtime = "nodejs";

export async function POST(request) {
  const body = await request.json();
  const next = await updateRuntimeState((state) => ({
    ...state,
    agents: state.agents.filter((agent) => agent.id !== body.id || agent.isDefaultRole),
  }));
  return NextResponse.json({ ok: true, state: next });
}
