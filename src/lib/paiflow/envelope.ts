import "server-only";
import { FeeBumpTransaction, TransactionBuilder } from "@stellar/stellar-sdk";

/** Transaction hash (hex) of an envelope under the given network passphrase. */
export function transactionHash(xdr: string, networkPassphrase: string): string {
  const tx = TransactionBuilder.fromXDR(xdr, networkPassphrase);
  if (tx instanceof FeeBumpTransaction) throw new EnvelopeMismatchError();
  return Buffer.from(tx.hash()).toString("hex");
}

/**
 * Rejects a signed envelope whose transaction body differs from the saved
 * original preparation. Added signatures are allowed; a changed body or a
 * fee-bump wrapper is not.
 */
export function assertOriginalEnvelope(
  signedXdr: string,
  originalXdr: string,
  networkPassphrase: string,
): string {
  let signedHash: string;
  try {
    signedHash = transactionHash(signedXdr, networkPassphrase);
  } catch {
    throw new EnvelopeMismatchError();
  }
  if (signedHash !== transactionHash(originalXdr, networkPassphrase)) {
    throw new EnvelopeMismatchError();
  }
  return signedHash;
}

export class EnvelopeMismatchError extends Error {
  constructor() {
    super("Signed envelope does not match the original preparation");
  }
}
