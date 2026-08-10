from pathlib import Path


def test_mql5_bridge_source_is_read_only() -> None:
    project_root = Path(__file__).resolve().parents[3]
    source = (project_root / "mt5" / "Experts" / "MonteCarloBridge.mq5").read_text(encoding="utf-8")

    forbidden_calls = (
        "#include <Trade/Trade.mqh>",
        "OrderSend(",
        "PositionClose(",
        ".Buy(",
        ".Sell(",
    )
    assert all(call not in source for call in forbidden_calls)


def test_mql5_bridge_exposes_documented_connection_inputs() -> None:
    project_root = Path(__file__).resolve().parents[3]
    source = (project_root / "mt5" / "Experts" / "MonteCarloBridge.mq5").read_text(
        encoding="utf-8"
    )

    assert "input string BridgeBaseUrl" in source
    assert "input string BridgeTerminalId" in source
    assert "input string MT5_API_KEY" in source
    assert "input int    QuoteSeconds" in source
    assert "input int    CandleLookbackDays" in source
    assert 'HttpPost("/api/v1/mt5/quotes"' in source
    assert "SymbolInfoTick(symbol,tick)" in source
    assert "BridgeApiKey" not in source


def test_mql5_bridge_backfills_candles_and_sends_symbol_trade_spec() -> None:
    project_root = Path(__file__).resolve().parents[3]
    source = (project_root / "mt5" / "Experts" / "MonteCarloBridge.mq5").read_text(
        encoding="utf-8"
    )

    assert "CopyRates(symbol,CandleTimeframe,from_time,to_time,rates)" in source
    assert "CandleLookbackDays)*86400" in source
    assert 'HttpPost("/api/v1/mt5/candles/coverage",coverage)' in source
    assert "g_last_candle_at[symbol_index]=previous_last" in source
    assert "FlushCandleBatch" in source
    assert "SYMBOL_VOLUME_MIN" in source
    assert "SYMBOL_VOLUME_STEP" in source
    assert "SYMBOL_VOLUME_MAX" in source
    assert "SYMBOL_TRADE_CONTRACT_SIZE" in source


def test_mt5_connection_settings_are_present_in_all_examples() -> None:
    project_root = Path(__file__).resolve().parents[3]
    settings = ("BridgeBaseUrl", "BridgeTerminalId", "MT5_API_KEY")

    for relative_path in (".env.example", "mt5/config.example"):
        example = (project_root / relative_path).read_text(encoding="utf-8")
        assert all(f"{setting}=" in example for setting in settings)
