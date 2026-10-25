import "server-only";

// Trusted server configuration. Never read these from browser input and never
// expose them through NEXT_PUBLIC_ variables.
export interface PaiflowConfig {
  baseUrl: string;
  deploymentId: string;
  token: string;
  shopAddress: string;
  communityAddress: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const G_ADDRESS = /^G[A-Z2-7]{55}$/;

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value || value.startsWith("YOUR_")) {
    throw new Error(`Missing server configuration: ${name}`);
  }
  return value;
}

let cached: PaiflowConfig | undefined;

export function getPaiflowConfig(): PaiflowConfig {
  if (cached) return cached;

  const config: PaiflowConfig = {
    baseUrl: required("PAIFLOW_BASE_URL"),
    deploymentId: required("PAIFLOW_DEPLOYMENT_ID"),
    token: required("PAIFLOW_API_TOKEN"),
    shopAddress: required("PAIFLOW_SHOP_ADDRESS"),
    communityAddress: required("PAIFLOW_COMMUNITY_ADDRESS"),
  };

  if (!UUID.test(config.deploymentId)) {
    throw new Error("PAIFLOW_DEPLOYMENT_ID must be the deployment UUID, not the flow ID or C… contract address");
  }
  if (!/^pf[dk]_/.test(config.token)) {
    throw new Error("PAIFLOW_API_TOKEN must be a pfd_ developer token or pfk_ deployment token");
  }
  for (const key of ["shopAddress", "communityAddress"] as const) {
    if (!G_ADDRESS.test(config[key])) throw new Error(`${key} must be a public G… address`);
  }
  if (config.shopAddress === config.communityAddress) {
    throw new Error("Split recipients must have distinct addresses");
  }

  cached = config;
  return config;
}

// Walkthrough order: 1 XLM split 90% shop / 10% community, in integer stroops.
export const ORDER_AMOUNT_STROOPS = 10_000_000n;
export const SPLITS = { shop: 9000n, community: 1000n } as const; // basis points

export function expectedPayouts(amount: bigint) {
  return {
    shop: (amount * SPLITS.shop) / 10_000n,
    community: (amount * SPLITS.community) / 10_000n,
  };
}

export function formatXlm(stroops: bigint): string {
  const whole = stroops / 10_000_000n;
  const frac = (stroops % 10_000_000n).toString().padStart(7, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}
