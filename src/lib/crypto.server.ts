// Server-only: holds hot-wallet private key. Never import from client code.
import { createWalletClient, createPublicClient, http, parseUnits, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

// USDC on Base (native, 6 decimals)
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;

const ERC20_ABI = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

function getAccount() {
  const pk = process.env.HOT_WALLET_EVM_PRIVATE_KEY;
  if (!pk) throw new Error("HOT_WALLET_EVM_PRIVATE_KEY not configured");
  const normalized = (pk.startsWith("0x") ? pk : `0x${pk}`) as `0x${string}`;
  return privateKeyToAccount(normalized);
}

function getRpcUrl() {
  return process.env.BASE_RPC_URL || "https://mainnet.base.org";
}

export async function sendUsdcOnBase(args: { to: `0x${string}`; amountCents: number }) {
  const account = getAccount();
  const rpc = getRpcUrl();

  const publicClient = createPublicClient({ chain: base, transport: http(rpc) });
  const walletClient = createWalletClient({ account, chain: base, transport: http(rpc) });

  // 1 USDC == $1 (treat 1 cent = 10_000 in 6-decimal USDC units)
  const amount = parseUnits((args.amountCents / 100).toFixed(2), 6);

  // Sanity: check hot-wallet balance
  const bal = (await publicClient.readContract({
    address: USDC_BASE,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [account.address],
  })) as bigint;
  if (bal < amount) {
    throw new Error(
      `Hot wallet USDC balance too low (${formatUnits(bal, 6)} USDC). Top up ${account.address} on Base.`,
    );
  }

  const hash = await walletClient.writeContract({
    address: USDC_BASE,
    abi: ERC20_ABI,
    functionName: "transfer",
    args: [args.to, amount],
  });

  return { txHash: hash, amountCrypto: Number(formatUnits(amount, 6)) };
}

export function getHotWalletInfo() {
  try {
    const account = getAccount();
    return { address: account.address, configured: true };
  } catch {
    return { address: null, configured: false };
  }
}
