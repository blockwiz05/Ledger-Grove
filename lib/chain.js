import {
  createPublicClient,
  decodeAbiParameters,
  encodeFunctionData,
  formatUnits,
  getAddress,
  http,
  isAddress,
  parseAbi,
  parseUnits,
} from "viem";
import { normalize } from "viem/ens";
import { mainnet } from "viem/chains";
import { RPC_URL, TOKENS, UNISWAP_QUOTER_V2 } from "./config.js";

const QUOTER_ABI = parseAbi([
  "function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96) params) view returns (uint256 amountOut,uint160 sqrtPriceX96After,uint32 initializedTicksCrossed,uint256 gasEstimate)",
]);

const QUOTER_OUTPUTS = [
  { type: "uint256", name: "amountOut" },
  { type: "uint160", name: "sqrtPriceX96After" },
  { type: "uint32", name: "initializedTicksCrossed" },
  { type: "uint256", name: "gasEstimate" },
];

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(RPC_URL, { timeout: 14_000 }),
});

export async function resolveEnsOrAddress(input, fallbackAddress = null) {
  const raw = (input || "").trim();
  if (!raw) {
    return {
      input: raw,
      normalizedName: null,
      address: fallbackAddress,
      sourceLabel: fallbackAddress ? "Fallback" : "Empty",
    };
  }

  if (isAddress(raw)) {
    let ensName = null;
    try {
      ensName = await publicClient.getEnsName({ address: getAddress(raw) });
    } catch {}
    return {
      input: raw,
      normalizedName: ensName,
      address: getAddress(raw),
      sourceLabel: ensName ? "Reverse ENS" : "Direct address",
    };
  }

  if (raw.includes(".") && !raw.startsWith("0x")) {
    try {
      const normalizedName = normalize(raw);
      const address = await publicClient.getEnsAddress({ name: normalizedName });
      return {
        input: raw,
        normalizedName,
        address: address ? getAddress(address) : fallbackAddress,
        sourceLabel: address ? "Live ENS" : fallbackAddress ? "Role fallback" : "ENS unresolved",
      };
    } catch {
      return {
        input: raw,
        normalizedName: raw,
        address: fallbackAddress,
        sourceLabel: fallbackAddress ? "Role fallback" : "ENS error",
      };
    }
  }

  return {
    input: raw,
    normalizedName: raw,
    address: fallbackAddress,
    sourceLabel: fallbackAddress ? "Role fallback" : "Unresolved",
  };
}

export async function resolveWalletIdentity(address) {
  return resolveEnsOrAddress(address);
}

export async function fetchBestUniswapQuote(tokenInSymbol, tokenOutSymbol, amountInHuman) {
  const tokenIn = TOKENS[tokenInSymbol];
  const tokenOut = TOKENS[tokenOutSymbol];

  if (!tokenIn || !tokenOut) {
    throw new Error("Unsupported token pair.");
  }
  if (tokenIn.symbol === tokenOut.symbol) {
    throw new Error("Choose two different assets.");
  }

  const contractTokenIn = tokenIn.symbol === "ETH" ? tokenIn.wrapped : tokenIn.address;
  const contractTokenOut = tokenOut.symbol === "ETH" ? tokenOut.wrapped : tokenOut.address;
  const amountIn = parseUnits(String(amountInHuman), tokenIn.decimals);
  const feeTiers = [500, 3000, 10000];

  const results = await Promise.all(
    feeTiers.map(async (fee) => {
      try {
        const data = encodeFunctionData({
          abi: QUOTER_ABI,
          functionName: "quoteExactInputSingle",
          args: [
            {
              tokenIn: contractTokenIn,
              tokenOut: contractTokenOut,
              amountIn,
              fee,
              sqrtPriceLimitX96: 0n,
            },
          ],
        });
        const response = await publicClient.call({
          to: UNISWAP_QUOTER_V2,
          data,
        });
        if (!response.data) return null;
        const [amountOut, , , gasEstimate] = decodeAbiParameters(QUOTER_OUTPUTS, response.data);
        return { fee, amountOut, gasEstimate };
      } catch {
        return null;
      }
    }),
  );

  const validResults = results.filter(Boolean);
  if (!validResults.length) {
    throw new Error("No compatible Uniswap V3 pool could be quoted for this pair.");
  }

  validResults.sort((a, b) => (a.amountOut > b.amountOut ? -1 : 1));
  const best = validResults[0];
  return {
    fee: best.fee,
    amountOutRaw: best.amountOut.toString(),
    outputAmount: Number(formatUnits(best.amountOut, tokenOut.decimals)),
    gasEstimate: best.gasEstimate ? Number(best.gasEstimate) : null,
    tokenIn,
    tokenOut,
  };
}
