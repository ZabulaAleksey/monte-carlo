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
    assert "input int    QuoteMilliseconds" in source
    assert "input int    PositionMilliseconds" in source
    assert "input int    AccountMilliseconds" in source
    assert "input int    TradeRetrySeconds" in source
    assert "input bool   IncludeAllBrokerQuotes" in source
    assert "input int    HistoryRequestSeconds" in source
    assert "input int    HistoryCopyRetryCount" in source
    assert "input int    CandleLookbackDays" in source
    assert '"/api/v1/mt5/quotes"' in source
    assert "SymbolInfoTick(symbol,tick)" in source
    assert "EventSetMillisecondTimer(250)" in source
    assert "now_ms-g_last_position_at_ms" in source
    assert "now_ms-g_last_account_at_ms" in source
    assert "void OnTradeTransaction(" in source
    assert "g_trade_sync_pending=true" in source
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


def test_mql5_bridge_polls_and_fulfils_historical_requests() -> None:
    project_root = Path(__file__).resolve().parents[3]
    source = (project_root / "mt5" / "Experts" / "MonteCarloBridge.mq5").read_text(
        encoding="utf-8"
    )

    assert 'HttpGet("/api/v1/mt5/history/requests/next?terminal_id="' in source
    assert "CopyRates(symbol,timeframe," in source
    assert "for(int attempt=0;attempt<copy_attempts;attempt++)" in source
    assert "Sleep(250*(attempt+1))" in source
    assert '"/complete"' in source
    assert '"/fail"' in source
    assert "ProcessHistoricalRequest()" in source


def test_mql5_bridge_batches_changed_ticks_for_all_broker_symbols() -> None:
    project_root = Path(__file__).resolve().parents[3]
    source = (project_root / "mt5" / "Experts" / "MonteCarloBridge.mq5").read_text(
        encoding="utf-8"
    )

    assert "SymbolsTotal(selected_only)" in source
    assert "tick.time_msc<=g_last_quote_msc[i]" in source
    assert "accepted>=500" in source
    assert "InitializeCandleSymbols()" in source


def test_mql5_bridge_limits_periodic_candles_to_chart_symbol() -> None:
    project_root = Path(__file__).resolve().parents[3]
    source = (project_root / "mt5" / "Experts" / "MonteCarloBridge.mq5").read_text(
        encoding="utf-8"
    )

    start = source.index("void InitializeCandleSymbols()")
    end = source.index("void RefreshQuoteSymbolState()", start)
    initializer = source[start:end]

    assert "ArrayResize(g_symbol_names,1)" in initializer
    assert "g_symbol_names[0]=_Symbol" in initializer
    assert "SymbolsTotal(true)" not in initializer


def test_mql5_bridge_prioritizes_portfolio_sync_before_candle_backfill() -> None:
    project_root = Path(__file__).resolve().parents[3]
    source = (project_root / "mt5" / "Experts" / "MonteCarloBridge.mq5").read_text(
        encoding="utf-8"
    )

    start = source.index("bool SynchronizeAll()")
    end = source.index("int OnInit()", start)
    synchronizer = source[start:end]

    assert synchronizer.index("SendAccount()") < synchronizer.index("SendCandles()")
    assert synchronizer.index("SendPositions()") < synchronizer.index("SendCandles()")
    assert synchronizer.index("SendTrades()") < synchronizer.index("SendCandles()")
    assert synchronizer.index("SendTrades()") < synchronizer.index(
        "RefreshQuoteSymbolState()"
    )
    assert "g_last_sync_at=now;" in source


def test_mql5_bridge_batches_background_market_sync_without_retries() -> None:
    project_root = Path(__file__).resolve().parents[3]
    source = (project_root / "mt5" / "Experts" / "MonteCarloBridge.mq5").read_text(
        encoding="utf-8"
    )

    symbols_start = source.index("bool SendSymbols()")
    quotes_start = source.index("bool SendQuotes()", symbols_start)
    quotes_end = source.index("bool FlushCandleBatch(", quotes_start)
    symbols = source[symbols_start:quotes_start]
    quotes = source[quotes_start:quotes_end]
    timer = source[source.index("void OnTimer()") :]

    assert "finish=MathMin(total,start+500)" in symbols
    assert "for(int i=start;i<finish;i++)" in symbols
    assert "g_symbol_catalog_cursor=finish" in symbols
    assert 'HttpPostBackground("/api/v1/mt5/symbols"' in symbols
    assert "finish=MathMin(total,start+500)" in quotes
    assert "for(int i=start;i<finish;i++)" in quotes
    assert "g_quote_cursor=(finish>=total ? 0 : finish)" in quotes
    assert 'HttpPostBackground("/api/v1/mt5/quotes"' in quotes
    assert "BackgroundRequestTimeoutMs" in source
    assert "BackgroundRequestTimeoutMs)),0)" in source
    assert timer.index("SendAccount()") < timer.index("SendQuotes()")
    assert timer.index("SendPositions()") < timer.index("SendQuotes()")
    assert "SetPriorityQuoteSymbol(symbol)" in source
    assert "SYMBOL_CALC_MODE_FOREX" in source
    assert "SYMBOL_CALC_MODE_FOREX_NO_LEVERAGE" in source
    assert "g_fx_quote_cursor=(finish>=total ? 0 : finish)" in source
    assert timer.index("SendFxQuotes()") < timer.index("SendSymbols()")
    assert "SendQuoteAtIndex(g_chart_quote_index)" in source
    assert "SendQuoteAtIndex(g_priority_quote_index)" in source
    assert timer.index("SendPriorityQuote()") < timer.index("SendSymbols()")
    assert timer.index("SendPriorityQuote()") < timer.index("SendQuotes()")


def test_mql5_bridge_reports_only_exit_deals_as_closed_trades() -> None:
    project_root = Path(__file__).resolve().parents[3]
    source = (project_root / "mt5" / "Experts" / "MonteCarloBridge.mq5").read_text(
        encoding="utf-8"
    )

    assert "DEAL_ENTRY_OUT" in source
    assert "DEAL_ENTRY_OUT_BY" in source
    assert "deal_entry!=DEAL_ENTRY_INOUT" in source
    assert "FindPositionEntry(position_id" in source


def test_mt5_connection_settings_are_present_in_all_examples() -> None:
    project_root = Path(__file__).resolve().parents[3]
    settings = ("BridgeBaseUrl", "BridgeTerminalId", "MT5_API_KEY")

    for relative_path in (".env.example", "mt5/config.example"):
        example = (project_root / relative_path).read_text(encoding="utf-8")
        assert all(f"{setting}=" in example for setting in settings)
