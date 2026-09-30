"""Inactive storage envelope for versioned market observations.

This module performs validation only. It does not persist or ingest raw ticks.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import StrEnum
from uuid import UUID


class MarketRecordKind(StrEnum):
    TICK = "tick"
    MARKET_EVENT = "market_event"


def _require_utc(value: datetime, field: str) -> None:
    if not isinstance(value, datetime) or value.utcoffset() != timedelta(0):
        raise ValueError(f"{field} must be an aware UTC datetime")


def _require_identity(value: str, field: str, limit: int = 128) -> None:
    if not isinstance(value, str) or not value or value != value.strip() or len(value) > limit:
        raise ValueError(f"{field} must be a bounded nonblank identity")


@dataclass(frozen=True, slots=True)
class MarketRecordEnvelope:
    kind: MarketRecordKind
    symbol_id: UUID
    source_id: str
    source_record_id: str
    effective_at: datetime
    observed_at: datetime
    payload_sha256: str
    dataset_version: str

    def __post_init__(self) -> None:
        if not isinstance(self.kind, MarketRecordKind):
            raise ValueError("kind must be an approved record kind")
        if not isinstance(self.symbol_id, UUID):
            raise ValueError("symbol_id must be a UUID")
        _require_identity(self.source_id, "source_id")
        _require_identity(self.source_record_id, "source_record_id")
        _require_identity(self.dataset_version, "dataset_version")
        _require_utc(self.effective_at, "effective_at")
        _require_utc(self.observed_at, "observed_at")
        if not isinstance(self.payload_sha256, str) or not re.fullmatch(
            r"[0-9a-f]{64}", self.payload_sha256
        ):
            raise ValueError("payload_sha256 must be a lowercase SHA-256 digest")

    @property
    def source_identity(self) -> tuple[str, MarketRecordKind, UUID, str, str]:
        """Conflict key within one immutable dataset version."""
        return (
            self.dataset_version,
            self.kind,
            self.symbol_id,
            self.source_id,
            self.source_record_id,
        )

    @property
    def partition_identity(self) -> tuple[datetime, str, MarketRecordKind, UUID, str, str]:
        """Candidate time-partition key; no Timescale compatibility is claimed."""
        return (self.effective_at, *self.source_identity)

    def visible_as_of(self, cutoff: datetime) -> bool:
        _require_utc(cutoff, "cutoff")
        return self.effective_at <= cutoff and self.observed_at <= cutoff

    def conflicts_with(self, other: MarketRecordEnvelope) -> bool:
        """Detect an attempted in-version mutation of one source record."""
        return self.source_identity == other.source_identity and self != other
