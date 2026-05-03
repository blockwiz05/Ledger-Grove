export const RPC_URL = "https://eth.llamarpc.com";
export const UNISWAP_QUOTER_V2 = "0x61fFE014bA17989E743c5F6cB21bF9697530B21e";
export const UNISWAP_APP_BASE = "https://app.uniswap.org/#/swap";

export const TOKENS = {
  ETH: {
    symbol: "ETH",
    label: "Ether",
    address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
    wrapped: "0xC02aaA39b223FE8D0A0E5C4F27eAD9083C756Cc2",
    decimals: 18,
  },
  USDC: {
    symbol: "USDC",
    label: "USD Coin",
    address: "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    decimals: 6,
  },
  DAI: {
    symbol: "DAI",
    label: "Dai",
    address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    decimals: 18,
  },
  USDT: {
    symbol: "USDT",
    label: "Tether",
    address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    decimals: 6,
  },
};

export const POLICY_PROFILES = {
  balanced: {
    traderSwapMax: 2500,
    traderRebalanceMax: 3000,
    opsTransferMax: 750,
    researchTransferMax: 250,
    slippageMax: 0.8,
  },
  defensive: {
    traderSwapMax: 1200,
    traderRebalanceMax: 1800,
    opsTransferMax: 400,
    researchTransferMax: 150,
    slippageMax: 0.5,
  },
  growth: {
    traderSwapMax: 5000,
    traderRebalanceMax: 6500,
    opsTransferMax: 1000,
    researchTransferMax: 400,
    slippageMax: 1.2,
  },
};

export const ROLE_BLUEPRINTS = [
  {
    key: "founder",
    title: "Founder Review",
    blurb: "Final reviewer and override authority for treasury actions.",
    permissions: ["all treasury actions", "override policy blocks", "high-value approvals"],
    fallbackAddress: "0xAb5801a7D398351b8bE11C439e05C5B3259aec9B",
  },
  {
    key: "trader",
    title: "Trading Agent",
    blurb: "Owns quote discovery, stable rotations, and market rebalancing.",
    permissions: ["swap into core assets", "treasury rebalance", "quote discovery"],
    fallbackAddress: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  },
  {
    key: "ops",
    title: "Ops Agent",
    blurb: "Handles routine budget movements, top-ups, and vendor payouts.",
    permissions: ["budget transfer", "recipient validation", "vendor payouts"],
    fallbackAddress: "0x000000000000000000000000000000000000dEaD",
  },
  {
    key: "research",
    title: "Research Agent",
    blurb: "Requests small budgets and can inspect quotes without moving treasury risk.",
    permissions: ["small transfer requests", "quote visibility", "proposal drafting"],
    fallbackAddress: "0x0000000000000000000000000000000000000001",
  },
];

export const ROLE_NAME = {
  founder: "Founder Review",
  trader: "Trading Agent",
  ops: "Ops Agent",
  research: "Research Agent",
};

export const DEFAULT_OWNER_CONFIG = {
  teamRoot: "0xvinit.eth",
  treasuryInput: "vitalik.eth",
  policyProfile: "balanced",
};

export const DEFAULT_AUTOMATION_CONFIG = {
  enabled: true,
  currentStableRatio: 72,
  targetStableRatio: 60,
  treasuryUsd: 18000,
  researchUsdcBalance: 25,
  researchTopupThreshold: 50,
  researchTopupAmount: 100,
  cycleSeconds: 15,
};

export function createDefaultAgents(teamRoot) {
  return [
    {
      id: "default-trader",
      name: "Market Steward",
      roleKey: "trader",
      ens: `trader.${teamRoot}`,
      walletOrEns: `trader.${teamRoot}`,
      resolvedAddress: findRole("trader").fallbackAddress,
      triggerType: "rebalance",
      automationEnabled: true,
      isDefaultRole: true,
      runtimeUrl: "",
    },
    {
      id: "default-ops",
      name: "Ops Relay",
      roleKey: "ops",
      ens: `ops.${teamRoot}`,
      walletOrEns: `ops.${teamRoot}`,
      resolvedAddress: findRole("ops").fallbackAddress,
      triggerType: "topup",
      automationEnabled: false,
      isDefaultRole: true,
      runtimeUrl: "",
    },
    {
      id: "default-research",
      name: "Research Requester",
      roleKey: "research",
      ens: `research.${teamRoot}`,
      walletOrEns: `research.${teamRoot}`,
      resolvedAddress: findRole("research").fallbackAddress,
      triggerType: "topup",
      automationEnabled: false,
      isDefaultRole: true,
      runtimeUrl: "",
    },
    {
      id: "default-founder",
      name: "Founder Escalation",
      roleKey: "founder",
      ens: `founder.${teamRoot}`,
      walletOrEns: `founder.${teamRoot}`,
      resolvedAddress: findRole("founder").fallbackAddress,
      triggerType: "review",
      automationEnabled: false,
      isDefaultRole: true,
      runtimeUrl: "",
    },
  ];
}

export function createDefaultRuntimeState() {
  return {
    ownerConfig: { ...DEFAULT_OWNER_CONFIG },
    automationConfig: { ...DEFAULT_AUTOMATION_CONFIG },
    agents: createDefaultAgents(DEFAULT_OWNER_CONFIG.teamRoot),
    auditLog: [],
    automationEvents: [],
    actionReports: [],
    pendingActions: [],
    latestAction: null,
  };
}

export function findRole(roleKey) {
  return ROLE_BLUEPRINTS.find((role) => role.key === roleKey) || ROLE_BLUEPRINTS[0];
}

export function buildUniswapLink(tokenIn, tokenOut) {
  const inputCurrency = tokenIn.symbol === "ETH" ? "ETH" : tokenIn.address;
  const outputCurrency = tokenOut.symbol === "ETH" ? "ETH" : tokenOut.address;
  return `${UNISWAP_APP_BASE}?inputCurrency=${encodeURIComponent(inputCurrency)}&outputCurrency=${encodeURIComponent(outputCurrency)}`;
}
