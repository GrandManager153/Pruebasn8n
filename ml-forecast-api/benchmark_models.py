#!/usr/bin/env python3
"""Compare Random Forest solo vs ML ensemble on dashboard payload data."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))

from model import run_forecast  # noqa: E402


def load_series(payload_path: Path) -> tuple[list[dict], dict]:
    with payload_path.open(encoding="utf-8") as handle:
        payload = json.load(handle)

    rf = payload.get("forecast_rf") or {}
    forecast = payload.get("forecast") or {}
    series = rf.get("time_series") or forecast.get("time_series")
    if not series:
        raise SystemExit(f"No time_series found in {payload_path}")

    return series, payload


def main() -> None:
    payload_path = ROOT / "data" / "dashboard_payload.json"
    if len(sys.argv) > 1:
        payload_path = Path(sys.argv[1])

    series, payload = load_series(payload_path)
    changepoint = forecast.get("changepoint") if (forecast := payload.get("forecast")) else None

    print(f"Payload: {payload_path}")
    print(f"Series length: {len(series)} days\n")

    result = run_forecast(series, model="compare", changepoint=changepoint)
    if result.get("error"):
        print("ERROR:", result["error"])
        sys.exit(1)

    diag = result.get("diagnostics") or {}
    rf_mase = (diag.get("all_mase") or {}).get("random_forest")
    selected = result.get("model_name")
    selected_mase = result.get("mase")

    print("=== Resultado seleccionado ===")
    print(f"Modelo:     {selected}")
    print(f"MASE:       {selected_mase}")
    print(f"Pronostico: {result.get('recommended_value')} leads")
    print(f"Ensemble:   {diag.get('ensemble_used')} ({diag.get('ensemble_type')})")

    if diag.get("ensemble_components"):
        print(f"Componentes: {', '.join(diag['ensemble_components'])}")
    if diag.get("ensemble_weights"):
        print(f"Pesos: {diag['ensemble_weights']}")

    if diag.get("ensemble_candidates"):
        print("\n=== Candidatos ensemble evaluados ===")
        for item in diag["ensemble_candidates"]:
            print(f"  {item['model']}: MASE {item['mase']}  ({', '.join(item['components'])})")

    if diag.get("selection_note"):
        print(f"\nNota: {diag['selection_note']}")

    print("\n=== MASE por modelo (holdout) ===")
    for name, mase in sorted((diag.get("all_mase") or {}).items(), key=lambda item: item[1]):
        marker = "  <-- RF" if name == "random_forest" else ""
        print(f"  {name:22s} {mase}{marker}")

    print("\n=== Veredicto vs Random Forest ===")
    if rf_mase is None:
        print("No se encontro MASE de random_forest en el backtest.")
    elif selected == "random_forest":
        print(f"Se mantiene RF solo (MASE {rf_mase}). El ensemble no supero el umbral de mejora.")
    elif selected_mase is not None and selected_mase < rf_mase:
        gain = rf_mase - selected_mase
        print(f"OK: {selected} supera a RF por {gain:.4f} MASE ({rf_mase} -> {selected_mase})")
    else:
        print(f"RF sigue siendo referencia ({rf_mase}). Seleccion actual: {selected} ({selected_mase})")


if __name__ == "__main__":
    main()
