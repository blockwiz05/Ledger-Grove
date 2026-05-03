import { NextResponse } from "next/server";
import { buildUniswapLink, POLICY_PROFILES, TOKENS } from "../../../../lib/config.js";
import { fetchBestUniswapQuote, resolveEnsOrAddress } from "../../../../lib/chain.js";
import { evaluatePolicy } from "../../../../lib/policy.js";
import { updateRuntimeState } from "../../../../lib/runtime-store.js";

export const runtime = "nodejs";

export async function POST() {
  const result = await updateRuntimeState(async (state) => {
    const now = new Date().toISOString();
    const generatedActions = [];
    const newEvents = [];
    const newAudit = [];
    const profile = POLICY_PROFILES[state.ownerConfig.policyProfile] || POLICY_PROFILES.balanced;

    const traderAgent = state.agents.find(
      (agent) => agent.roleKey === "trader" && agent.automationEnabled,
    );
    if (traderAgent) {
      const stableExcess =
        ((state.automationConfig.currentStableRatio - state.automationConfig.targetStableRatio) /
          100) *
        state.automationConfig.treasuryUsd;

      if (stableExcess > 0) {
        const amountUsd = Math.min(
          stableExcess,
          profile.traderRebalanceMax,
          profile.traderSwapMax,
        );
        const policy = evaluatePolicy({
          actionType: "swap",
          roleKey: "trader",
          amountUsd,
          slippage: profile.slippageMax,
          profileKey: state.ownerConfig.policyProfile,
          teamRoot: state.ownerConfig.teamRoot,
        });

        if (policy.status !== "blocked") {
          const quote = await fetchBestUniswapQuote("USDC", "ETH", amountUsd);
          const action = {
            id: `action-${Date.now()}-swap`,
            type: "swap",
            source: "automation",
            actorName: traderAgent.name,
            actorEns: traderAgent.ens,
            roleKey: "trader",
            status: policy.status,
            amountUsd,
            tokenIn: "USDC",
            tokenOut: "ETH",
            outputAmount: quote.outputAmount,
            fee: quote.fee,
            executionLink: buildUniswapLink(TOKENS.USDC, TOKENS.ETH),
            timestamp: now,
          };
          generatedActions.push(action);
          newEvents.push({
            id: `event-${Date.now()}-swap`,
            timestamp: now,
            agentName: traderAgent.name,
            ens: traderAgent.ens,
            roleKey: "trader",
            status: policy.status,
            message: `Prepared ${amountUsd.toFixed(0)} USDC -> ETH because stable ratio is above target.`,
          });
          newAudit.push({
            id: `audit-${Date.now()}-swap`,
            timestamp: now,
            action: "auto-rebalance",
            roleKey: "trader",
            status: policy.status,
            details: {
              actor: traderAgent.name,
              amountUsd: amountUsd.toFixed(2),
              outputAmount: quote.outputAmount.toFixed(4),
            },
          });
        }
      }
    }

    const opsAgent = state.agents.find(
      (agent) => agent.roleKey === "ops" && agent.automationEnabled,
    );
    if (
      opsAgent &&
      state.automationConfig.researchUsdcBalance < state.automationConfig.researchTopupThreshold
    ) {
      const amountUsd = state.automationConfig.researchTopupAmount;
      const policy = evaluatePolicy({
        actionType: "transfer",
        roleKey: "ops",
        amountUsd,
        profileKey: state.ownerConfig.policyProfile,
        teamRoot: state.ownerConfig.teamRoot,
      });
      if (policy.status !== "blocked") {
        const destination = await resolveEnsOrAddress(
          `research.${state.ownerConfig.teamRoot}`,
        );
        const action = {
          id: `action-${Date.now()}-topup`,
          type: "transfer",
          source: "automation",
          actorName: opsAgent.name,
          actorEns: opsAgent.ens,
          roleKey: "ops",
          status: policy.status,
          amountUsd,
          token: "USDC",
          destination: destination.normalizedName || destination.address,
          timestamp: now,
        };
        generatedActions.push(action);
        newEvents.push({
          id: `event-${Date.now()}-topup`,
          timestamp: now,
          agentName: opsAgent.name,
          ens: opsAgent.ens,
          roleKey: "ops",
          status: policy.status,
          message: `Prepared ${amountUsd} USDC top-up because research balance fell below threshold.`,
        });
        newAudit.push({
          id: `audit-${Date.now()}-topup`,
          timestamp: now,
          action: "auto-topup",
          roleKey: "ops",
          status: policy.status,
          details: {
            actor: opsAgent.name,
            amountUsd,
            destination: destination.normalizedName || destination.address,
          },
        });
      }
    }

    return {
      ...state,
      latestAction: generatedActions[0] || state.latestAction,
      pendingActions: [...generatedActions, ...state.pendingActions].slice(0, 20),
      automationEvents: [...newEvents, ...state.automationEvents].slice(0, 20),
      auditLog: [...newAudit, ...state.auditLog].slice(0, 40),
    };
  });

  return NextResponse.json({
    ok: true,
    state: result,
    latestAction: result.latestAction,
  });
}
