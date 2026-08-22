import type { PositionRecord, SymbolRecord, TradeRecord, TradeSide, TradeStatus } from "@/lib/api/types";

export interface ExecutionRow {
  externalId: string;
  id: string;
  openedAt: string;
  pnl: number;
  side: TradeSide;
  status: TradeStatus;
  symbolName: string;
  volume: string;
}

export function isLegacyEntryExecution(trade: TradeRecord): boolean {
  return trade.status === "closed"
    && trade.closed_at === trade.opened_at
    && trade.close_price === trade.open_price
    && Number(trade.profit) === 0;
}

export function buildExecutionRows(
  positions: PositionRecord[],
  trades: TradeRecord[],
  symbols: SymbolRecord[],
): ExecutionRow[] {
  const symbolById = new Map(symbols.map((symbol) => [symbol.id, symbol.name]));
  const openRows = positions.map((position) => ({
    id: `position:${position.id}`,
    externalId: position.external_id,
    symbolName: symbolById.get(position.symbol_id) ?? "—",
    side: position.side,
    volume: position.volume,
    openedAt: position.opened_at,
    status: position.status,
    pnl: Number(position.profit) + Number(position.swap),
  }));
  const closedRows = trades.filter((trade) => !isLegacyEntryExecution(trade)).map((trade) => ({
    id: `trade:${trade.id}`,
    externalId: trade.external_id,
    symbolName: symbolById.get(trade.symbol_id) ?? "—",
    side: trade.side,
    volume: trade.volume,
    openedAt: trade.opened_at,
    status: trade.status,
    pnl: Number(trade.profit) + Number(trade.commission) + Number(trade.swap),
  }));
  return [...openRows, ...closedRows].sort(
    (left, right) => Date.parse(right.openedAt) - Date.parse(left.openedAt),
  );
}
