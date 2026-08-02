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
    assert "BridgeApiKey" not in source


def test_mt5_connection_settings_are_present_in_all_examples() -> None:
    project_root = Path(__file__).resolve().parents[3]
    settings = ("BridgeBaseUrl", "BridgeTerminalId", "MT5_API_KEY")

    for relative_path in (".env.example", "mt5/config.example"):
        example = (project_root / relative_path).read_text(encoding="utf-8")
        assert all(f"{setting}=" in example for setting in settings)
