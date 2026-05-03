import { NextResponse } from "next/server";
import { evaluatePolicy } from "../../../../lib/policy.js";
import { readRuntimeState } from "../../../../lib/runtime-store.js";

export const runtime = "nodejs";

export async function POST(request) {
  const body = await request.json();
  const state = await readRuntimeState();

  const matchedAgent =
    state.agents.find((agent) => body.agentId && agent.id === body.agentId) ||
    state.agents.find((agent) => body.ens && agent.ens === body.ens) ||
    state.agents.find(
      (agent) =>
        body.wallet &&
        (agent.walletOrEns === body.wallet || agent.resolvedAddress === body.wallet),
    );

  if (!matchedAgent) {
    return NextResponse.json(
      {
        ok: false,
        error: "Agent not registered.",
      },
      { status: 404 },
    );
  }

  const result = evaluatePolicy({
    actionType: body.actionType,
    roleKey: matchedAgent.roleKey,
    amountUsd: Number(body.amountUsd || 0),
    slippage: Number(body.slippage || 0),
    profileKey: state.ownerConfig.policyProfile,
    teamRoot: state.ownerConfig.teamRoot,
  });

  return NextResponse.json({
    ok: true,
    policy: result,
    matchedAgent,
    constraints: {
      policyProfile: state.ownerConfig.policyProfile,
      treasuryOwner: state.ownerConfig.teamRoot,
    },
  });
}
