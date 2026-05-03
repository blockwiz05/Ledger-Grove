import { NextResponse } from "next/server";
import { readRuntimeState } from "../../../lib/runtime-store.js";
import { resolveEnsOrAddress } from "../../../lib/chain.js";

export const runtime = "nodejs";

export async function GET() {
  const state = await readRuntimeState();
  const owner = await resolveEnsOrAddress(state.ownerConfig.teamRoot);
  const treasury = await resolveEnsOrAddress(state.ownerConfig.treasuryInput);
  const resolvedAgents = await Promise.all(
    state.agents.map(async (agent) => ({
      id: agent.id,
      resolved: await resolveEnsOrAddress(
        agent.walletOrEns || agent.ens || "",
        agent.resolvedAddress || null,
      ),
    })),
  );
  return NextResponse.json({
    ok: true,
    state,
    ownerResolution: owner,
    treasuryResolution: treasury,
    resolvedAgents,
  });
}
