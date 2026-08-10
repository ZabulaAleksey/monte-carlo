from enum import StrEnum


class CandleSource(StrEnum):
    API = "api"
    DEMO = "demo"
    MT5 = "mt5"


class TradeSide(StrEnum):
    BUY = "buy"
    SELL = "sell"


class TradeStatus(StrEnum):
    OPEN = "open"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class HistoricalDataRequestState(StrEnum):
    PENDING = "pending"
    CLAIMED = "claimed"
    COMPLETED = "completed"
    FAILED = "failed"
