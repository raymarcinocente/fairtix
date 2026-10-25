import { demoExchangeRates } from "@/lib/exchange-rates";

export function GET() {
  return Response.json(demoExchangeRates);
}
