import type { AccountRecord } from "@/lib/api/types";

export type DataEnvironment = "mt5" | "demo" | "empty";

export function isDemoAccount(account: AccountRecord): boolean {
  return account.external_id.toUpperCase().startsWith("DEMO-");
}

function newestFirst(accounts: AccountRecord[]): AccountRecord[] {
  return [...accounts].sort(
    (left, right) => Date.parse(right.created_at) - Date.parse(left.created_at),
  );
}

export function selectPortfolioAccount(
  accounts: AccountRecord[],
  preferredExternalId?: string | null,
): AccountRecord | null {
  const ordered = newestFirst(accounts);
  const preferred = preferredExternalId
    ? ordered.find((account) => account.external_id === preferredExternalId)
    : null;
  if (preferred) return preferred;
  return ordered.find((account) => !isDemoAccount(account)) ?? ordered[0] ?? null;
}

export function selectEnvironmentAccount(
  accounts: AccountRecord[],
  connected: boolean,
): AccountRecord | null {
  const ordered = newestFirst(accounts);
  return connected
    ? ordered.find((account) => !isDemoAccount(account)) ?? null
    : ordered.find(isDemoAccount) ?? null;
}

export function resolveAccountEnvironment(
  account: AccountRecord | null,
): DataEnvironment {
  if (!account) return "empty";
  return isDemoAccount(account) ? "demo" : "mt5";
}
