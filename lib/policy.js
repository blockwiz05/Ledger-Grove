import { POLICY_PROFILES, ROLE_NAME } from "./config.js";

export function evaluatePolicy({
  actionType,
  roleKey,
  amountUsd,
  slippage = 0,
  profileKey = "balanced",
  teamRoot = "0xvinit.eth",
}) {
  const profile = POLICY_PROFILES[profileKey] || POLICY_PROFILES.balanced;
  const founderName = `founder.${teamRoot}`;

  if (actionType === "swap") {
    if (roleKey === "founder") return approved("Founder can execute direct swaps.");
    if (roleKey !== "trader") {
      return blocked(`${ROLE_NAME[roleKey]} cannot directly execute treasury swaps. Route this request to ${founderName}.`);
    }
    if (slippage > profile.slippageMax) {
      return blocked(`Requested slippage of ${slippage}% exceeds the ${profile.slippageMax}% policy limit.`);
    }
    if (amountUsd > profile.traderSwapMax) {
      return review(`Trader may quote the route, but notional above $${profile.traderSwapMax.toLocaleString()} requires ${founderName}.`);
    }
    return approved("Swap fits the active policy profile.");
  }

  if (actionType === "transfer") {
    if (roleKey === "founder") return approved("Founder can move any approved budget.");
    if (roleKey === "ops") {
      return amountUsd > profile.opsTransferMax
        ? review(`Ops transfers above $${profile.opsTransferMax.toLocaleString()} require founder approval.`)
        : approved("Ops transfer fits the active policy profile.");
    }
    if (roleKey === "research") {
      return amountUsd > profile.researchTransferMax
        ? blocked(`Research is limited to small requests up to $${profile.researchTransferMax.toLocaleString()}.`)
        : review("Research transfers always require founder confirmation, even within budget.");
    }
    if (roleKey === "trader") {
      return review("Trader transfers require founder review to avoid bypassing swap controls.");
    }
  }

  return blocked("No matching policy rule found.");
}

export function buildPolicySummary(role, profileKey, teamRoot) {
  const profile = POLICY_PROFILES[profileKey] || POLICY_PROFILES.balanced;
  return [
    {
      title: "Identity binding",
      body: `Every ${role.key}.${teamRoot} runtime is mapped to an ENS name or wallet before it can touch treasury policy.`,
    },
    {
      title: "Swap authority",
      body:
        role.key === "trader" || role.key === "founder"
          ? `Trader autonomy is capped at $${profile.traderSwapMax.toLocaleString()} with max ${profile.slippageMax}% slippage.`
          : `Only trader.${teamRoot} or founder.${teamRoot} may execute treasury swaps.`,
    },
    {
      title: "Transfer authority",
      body: `Ops can move up to $${profile.opsTransferMax.toLocaleString()}, research can request up to $${profile.researchTransferMax.toLocaleString()}, and larger moves escalate.`,
    },
  ];
}

export function estimateRoleRisk(roleKey) {
  return {
    founder: { score: 82, label: "High authority" },
    trader: { score: 61, label: "Market-facing" },
    ops: { score: 34, label: "Operational" },
    research: { score: 21, label: "Sandboxed" },
  }[roleKey];
}

function approved(body) {
  return { status: "approved", tone: "approved", title: "Approved", body };
}

function review(body) {
  return { status: "review", tone: "review", title: "Review required", body };
}

function blocked(body) {
  return { status: "blocked", tone: "blocked", title: "Blocked", body };
}
