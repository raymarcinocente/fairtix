import "server-only";
import { Paiflow, type PaiflowDeployment } from "@paiflow/sdk";
import { getPaiflowConfig } from "./config";

let client: Paiflow | undefined;
let checked: Promise<PaiflowDeployment> | undefined;

function getClient(): Paiflow {
  const { baseUrl, token } = getPaiflowConfig();
  client ??= new Paiflow({ baseUrl, token });
  return client;
}

async function connect(): Promise<PaiflowDeployment> {
  const { deploymentId } = getPaiflowConfig();
  const paiflow = getClient();

  // Discovery confirms the token grants this deployment; it does not choose one.
  let selected = false;
  for await (const page of paiflow.deployments.pages({ limit: 20 }, { maxPages: 100 })) {
    if (page.data.items.some((item) => item.id === deploymentId)) {
      selected = true;
      break;
    }
  }
  if (!selected) throw new Error("Check the configured deployment and token grants");

  const deployment = paiflow.deployment(deploymentId);
  const { data: capabilities } = await deployment.capabilities.get();
  if (capabilities.network !== "testnet") {
    throw new Error("This walkthrough requires testnet");
  }
  if (capabilities.operations.execute.status === "unsupported") {
    throw new Error("This deployment does not support execute");
  }
  return deployment;
}

/** The configured deployment, verified once per server process. */
export function getDeployment(): Promise<PaiflowDeployment> {
  checked ??= connect().catch((error) => {
    checked = undefined;
    throw error;
  });
  return checked;
}

export async function getCapabilities() {
  const deployment = await getDeployment();
  return (await deployment.capabilities.get()).data;
}
