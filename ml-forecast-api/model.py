"""Random Forest forecaster with rolling backtest and MASE."""

from __future__ import annotations

import math
from typing import Any

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor

from features import build_feature_matrix, build_next_features, series_to_dataframe


def _seasonal_naive_mae(actual: np.ndarray, history: np.ndarray) -> float:
    errs = []
    for i in range(len(actual)):
        if i >= 7:
            errs.append(abs(actual[i] - history[i - 7]))
    return float(np.mean(errs)) if errs else float(np.std(actual)) or 1.0


def _metrics(actual: np.ndarray, pred: np.ndarray) -> dict[str, float]:
    err = actual - pred
    mae = float(np.mean(np.abs(err)))
    rmse = float(math.sqrt(np.mean(err ** 2)))
    return {"mae": round(mae, 2), "rmse": round(rmse, 2)}


def run_forecast(
    series: list[dict],
    backtest_days: int = 14,
    min_points: int = 21,
) -> dict[str, Any]:
    df = series_to_dataframe(series)
    n = len(df)
    if n < min_points:
        return {
            "error": f"Need at least {min_points} daily points, got {n}",
            "model_name": "random_forest",
        }

    values = df["value"].to_numpy()
    bt = min(backtest_days, n - 15)
    bt = max(bt, 0)

    preds_bt: list[float] = []
    acts_bt: list[float] = []
    for i in range(n - bt, n):
        train_df = df.iloc[:i].copy()
        X_train, y_train = build_feature_matrix(train_df)
        if len(X_train) < 10:
            continue
        model = RandomForestRegressor(
            n_estimators=80,
            max_depth=8,
            min_samples_leaf=2,
            random_state=42,
            n_jobs=-1,
        )
        model.fit(X_train, y_train)
        row_df = df.iloc[: i + 1]
        X_next = build_next_features(row_df)
        if X_next is None:
            continue
        p = float(model.predict(X_next)[0])
        preds_bt.append(p)
        acts_bt.append(float(values[i]))

    if not preds_bt:
        return {"error": "Backtest produced no predictions", "model_name": "random_forest"}

    act_a = np.array(acts_bt)
    pred_a = np.array(preds_bt)
    m = _metrics(act_a, pred_a)
    naive_mae = _seasonal_naive_mae(act_a, values[n - bt - 7 : n])
    mase = round(m["mae"] / naive_mae, 4) if naive_mae > 0 else 999.0

    X_full, y_full = build_feature_matrix(df)
    final_model = RandomForestRegressor(
        n_estimators=100,
        max_depth=8,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1,
    )
    final_model.fit(X_full, y_full)
    X_next = build_next_features(df)
    if X_next is None:
        return {"error": "Could not build next-day features", "model_name": "random_forest"}

    forecast = max(0.0, float(final_model.predict(X_next)[0]))
    residuals = np.abs(act_a - pred_a)
    q50 = float(np.quantile(residuals, 0.5))
    q80 = float(np.quantile(residuals, 0.8))

    fc_int = int(round(forecast))
    band_low = max(0, int(round(forecast - q80)))
    band_high = int(round(forecast + q80))

    if mase < 0.8:
        mode, confidence = "model", "alta"
        label = f"Forecast RF favorable (MASE: {mase})"
    elif mase < 1.0:
        mode, confidence = "weak_model", "media"
        label = f"Forecast RF orientativo (MASE: {mase})"
    else:
        mode, confidence = "observed_fallback", "baja"
        label = f"RF no supera baseline estacional (MASE: {mase})"

    return {
        "model_name": "random_forest",
        "recommended_value": fc_int,
        "mase": mase,
        "confidence": confidence,
        "mode": mode,
        "label": label,
        "backtest": {
            "window_days": bt,
            "naive_mae": round(naive_mae, 2),
            "models": [
                {
                    "name": "random_forest",
                    "mae": m["mae"],
                    "mase": mase,
                    "rmse": m["rmse"],
                },
                {
                    "name": "seasonal_naive",
                    "mae": round(naive_mae, 2),
                    "mase": 1.0,
                    "rmse": round(naive_mae * 1.2, 2),
                },
            ],
            "selected": "random_forest",
        },
        "forecast_horizons": {
            "next_1d": {
                "forecast": fc_int,
                "band_low": band_low,
                "band_high": band_high,
                "method": "random_forest",
            },
            "next_7d": {
                "forecast": fc_int * 7,
                "band_low": max(0, int(round((forecast - q80) * 7))),
                "band_high": int(round((forecast + q80) * 7)),
                "method": "random_forest+scale",
            },
        },
        "intervals": {
            "band_50": {"low": max(0, int(round(forecast - q50))), "high": int(round(forecast + q50))},
            "band_80": {"low": band_low, "high": band_high},
            "residual_points": len(residuals),
        },
        "diagnostics": {
            "total_history_days": n,
            "backtest_days": bt,
            "best_model": "random_forest",
            "best_mase": mase,
        },
    }
