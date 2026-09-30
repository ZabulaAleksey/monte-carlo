from dataclasses import replace
from datetime import UTC, datetime
from uuid import UUID

import pytest

from app.domain.market_data_storage import MarketRecordEnvelope, MarketRecordKind


@pytest.fixture
def record() -> MarketRecordEnvelope:
    return MarketRecordEnvelope(
        kind=MarketRecordKind.MARKET_EVENT,
        symbol_id=UUID("00000000-0000-0000-0000-000000000001"),
        source_id="mt5-terminal-a",
        source_record_id="event-42",
        effective_at=datetime(2026, 9, 1, 9, tzinfo=UTC),
        observed_at=datetime(2026, 9, 1, 11, tzinfo=UTC),
        payload_sha256="a" * 64,
        dataset_version="dataset-v1",
    )


def test_as_of_excludes_late_arrival_until_both_clocks_pass(record: MarketRecordEnvelope) -> None:
    assert not record.visible_as_of(datetime(2026, 9, 1, 10, tzinfo=UTC))
    assert record.visible_as_of(record.observed_at)
    with pytest.raises(ValueError, match="cutoff"):
        record.visible_as_of(datetime(2026, 9, 1, 12))


def test_source_conflict_is_separate_from_time_partition_identity(
    record: MarketRecordEnvelope,
) -> None:
    changed = replace(record, effective_at=record.observed_at, payload_sha256="b" * 64)
    assert changed.source_identity == record.source_identity
    assert changed.partition_identity != record.partition_identity
    assert record.conflicts_with(changed)
    assert not record.conflicts_with(replace(changed, dataset_version="dataset-v2"))
    assert not record.conflicts_with(replace(record))


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("kind", "unapproved_event"),
        ("source_id", " "),
        ("source_record_id", "x" * 129),
        ("dataset_version", " version "),
        ("effective_at", datetime(2026, 9, 1)),
        ("observed_at", datetime(2026, 9, 1)),
        ("payload_sha256", "A" * 64),
    ],
)
def test_invalid_envelope_rejected(record: MarketRecordEnvelope, field: str, value: object) -> None:
    with pytest.raises(ValueError):
        replace(record, **{field: value})
