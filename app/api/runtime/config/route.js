import { NextResponse } from "next/server";
import { createDefaultAgents } from "../../../../lib/config.js";
import { updateRuntimeState } from "../../../../lib/runtime-store.js";

export const runtime = "nodejs";

export async function POST(request) {
  const body = await request.json();
  const ownerConfig = body.ownerConfig || {};
  const automationConfig = body.automationConfig || {};

  const next = await updateRuntimeState((state) => {
    const nextOwner = { ...state.ownerConfig, ...ownerConfig };
    const nextAutomation = { ...state.automationConfig, ...automationConfig };
    const customAgents = state.agents.filter((agent) => !agent.isDefaultRole);
    return {
      ...state,
      ownerConfig: nextOwner,
      automationConfig: nextAutomation,
      agents: [...createDefaultAgents(nextOwner.teamRoot), ...customAgents],
    };
  });

  return NextResponse.json({ ok: true, state: next });
}
