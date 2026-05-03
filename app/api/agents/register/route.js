import { NextResponse } from "next/server";
import { findRole } from "../../../../lib/config.js";
import { resolveEnsOrAddress } from "../../../../lib/chain.js";
import { updateRuntimeState } from "../../../../lib/runtime-store.js";

export const runtime = "nodejs";

export async function POST(request) {
  const body = await request.json();
  const role = findRole(body.roleKey);
  const resolved = await resolveEnsOrAddress(
    body.walletOrEns || body.ens || `${body.roleKey}.${body.teamRoot || "0xvinit.eth"}`,
    role.fallbackAddress,
  );

  const agent = {
    id: body.id || `agent-${Date.now()}`,
    name: body.name || role.title,
    roleKey: body.roleKey,
    ens: body.ens,
    walletOrEns: body.walletOrEns,
    resolvedAddress: resolved.address || role.fallbackAddress,
    triggerType: body.triggerType || "topup",
    automationEnabled: body.automationEnabled !== false,
    isDefaultRole: false,
    runtimeUrl: body.runtimeUrl || "",
  };

  const next = await updateRuntimeState((state) => ({
    ...state,
    agents: [...state.agents.filter((entry) => entry.id !== agent.id), agent],
  }));

  return NextResponse.json({ ok: true, agent, state: next });
}
