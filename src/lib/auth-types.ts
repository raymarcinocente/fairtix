export type Role = "customer" | "organizer" | "administrator";
export type Transaction = {
  id: string;
  reference: string;
  eventId: string;
  kind: "purchase" | "resale purchase" | "resale sale";
  amount: number;
  currency: "XLM" | "USDC";
  createdAt: string;
};
export type Account = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  verified: boolean;
  role: Role;
  wallet: string | null;
};
export function safeReturnTo(value: string | null | undefined) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\r\n]/.test(value)
  )
    return "/account";
  try {
    const url = new URL(value, "https://fairtix.invalid");
    if (
      url.origin !== "https://fairtix.invalid" ||
      /^\/(login|register|forgot-password|reset-password|verify-email)(\/|$)/.test(
        url.pathname,
      )
    )
      return "/account";
    return url.pathname + url.search;
  } catch {
    return "/account";
  }
}
