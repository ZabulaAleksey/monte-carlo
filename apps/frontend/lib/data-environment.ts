import type {
  AccountRecord,
  CandleRecord,
  Mt5Status,
  TradeRecord,
} from "./api/types";
import { isDemoAccount } from "./dashboard";

export type EnvironmentKind = "demo" | "mt5";

export interface DataEnvironment {
  accountIds: string[];
  description: string;
  kind: EnvironmentKind;
  online: boolean;
  title: string;
}

export function deriveDataEnvironment(
  accounts: AccountRecord[],
  mt5: Mt5Status,
): DataEnvironment {
  const mt5Accounts = accounts.filter((account) => !isDemoAccount(account));
  const isMt5 = mt5.connected || mt5Accounts.length > 0;

  if (isMt5) {
    return {
      accountIds: mt5Accounts.map((account) => account.id),
      description: mt5.connected ? "Live terminal feed" : "Cached terminal data",
      kind: "mt5",
      online: mt5.connected,
      title: "MT5 environment",
    };
  }

  return {
    accountIds: accounts.filter(isDemoAccount).map((account) => account.id),
    description: "Sample market feed",
    kind: "demo",
    online: false,
    title: "Demo environment",
  };
}

export function filterTradesForEnvironment(
  trades: TradeRecord[],
  environment: DataEnvironment,
): TradeRecord[] {
  const accountIds = new Set(environment.accountIds);
  return trades.filter((trade) => accountIds.has(trade.account_id));
}

export function filterCandlesForEnvironment(
  candles: CandleRecord[],
  environment: DataEnvironment,
): CandleRecord[] {
  return candles.filter((candle) => candle.source === environment.kind);
}
