import { NextResponse } from "next/server";
import { evaluatePolicy } from "../../../../lib/policy.js";
import { readRuntimeState } from "../../../../lib/runtime-store.js";

export const runtime = "nodejs";

export async function POST(request) {
  const body = await request.json();
  const state = await readRuntimeState();
  const trace = [];

  trace.push({
    level: "api",
    message: `Policy check received. agentId=${body.agentId || "-"}, action=${body.actionType}, amountUsd=${body.amountUsd || 0}, slippage=${body.slippage || 0}.`,
  });

  const matchedAgent =
    state.agents.find((agent) => body.agentId && agent.id === body.agentId) ||
    state.agents.find((agent) => body.ens && agent.ens === body.ens) ||
    state.agents.find(
      (agent) =>
        body.wallet &&
        (agent.walletOrEns === body.wallet || agent.resolvedAddress === body.wallet),
    );

  if (!matchedAgent) {
    trace.push({
      level: "error",
      message: "Policy check failed. Agent not registered.",
    });
    return NextResponse.json(
      {
        ok: false,
        error: "Agent not registered.",
        trace,
      },
      { status: 404 },
    );
  }

  trace.push({
    level: "api",
    message: `Matched agent ${matchedAgent.name} as role=${matchedAgent.roleKey} under profile=${state.ownerConfig.policyProfile}.`,
  });

  const result = evaluatePolicy({
    actionType: body.actionType,
    roleKey: matchedAgent.roleKey,
    amountUsd: Number(body.amountUsd || 0),
    slippage: Number(body.slippage || 0),
    profileKey: state.ownerConfig.policyProfile,
    teamRoot: state.ownerConfig.teamRoot,
  });
  trace.push({
    level: result.status === "blocked" ? "error" : "api",
    message: `Policy result=${result.status}. ${result.body}`,
  });

  return NextResponse.json({
    ok: true,
    policy: result,
    matchedAgent,
    constraints: {
      policyProfile: state.ownerConfig.policyProfile,
      treasuryOwner: state.ownerConfig.teamRoot,
    },
    trace,
  });
}
