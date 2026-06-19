"""Forecasting models with rolling backtest, MASE, and model comparison."""

from __future__ import annotations

import math
from typing import Any

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.neural_network import MLPRegressor

from features import (
    build_adaptive_target_features,
    build_adaptive_train_matrix,
    build_backtest_target_features,
    build_backtest_train_matrix,
    build_feature_matrix,
    build_next_features,
    series_to_dataframe,
)

try:
    import lightgbm as lgb  # noqa: F401

    _HAS_LIGHTGBM = True
except ImportError:
    _HAS_LIGHTGBM = False

SKLEARN_MODEL_NAMES = [
    "random_forest",
    "gradient_boosting",
    "ridge",
    "mlp_neural_network",
]


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


def _make_sklearn_model(name: str):
    if name == "random_forest":
        return RandomForestRegressor(
            n_estimators=80,
            max_depth=8,
            min_samples_leaf=2,
            random_state=42,
            n_jobs=-1,
        )
    if name == "gradient_boosting":
        return GradientBoostingRegressor(
            n_estimators=80,
            max_depth=5,
            min_samples_leaf=2,
            random_state=42,
        )
    if name == "ridge":
        return Ridge(alpha=1.0)
    if name == "mlp_neural_network":
        return MLPRegressor(
            hidden_layer_sizes=(50, 25),
            max_iter=500,
            random_state=42,
        )
    if name == "lightgbm" and _HAS_LIGHTGBM:
        return lgb.LGBMRegressor(
            n_estimators=80,
            max_depth=6,
            learning_rate=0.1,
            random_state=42,
            verbose=-1,
        )
    raise ValueError(f"Unknown model: {name}")


def _make_final_model(name: str):
    if name == "random_forest":
        return RandomForestRegressor(
            n_estimators=100,
            max_depth=8,
            min_samples_leaf=2,
            random_state=42,
            n_jobs=-1,
        )
    if name == "gradient_boosting":
        return GradientBoostingRegressor(
            n_estimators=100,
            max_depth=5,
            min_samples_leaf=2,
            random_state=42,
        )
    if name == "ridge":
        return Ridge(alpha=1.0)
    if name == "mlp_neural_network":
        return MLPRegressor(
            hidden_layer_sizes=(50, 25),
            max_iter=500,
            random_state=42,
        )
    if name == "lightgbm" and _HAS_LIGHTGBM:
        return lgb.LGBMRegressor(
            n_estimators=100,
            max_depth=6,
            learning_rate=0.1,
            random_state=42,
            verbose=-1,
        )
    raise ValueError(f"Unknown model: {name}")


def _build_full_history_series(
    df: pd.DataFrame,
    model_names: list[str],
    min_train_rows: int = 2,
) -> dict[str, list[float | None]]:
    """One-step-ahead in-sample predictions for chart overlays across the full timeline."""
    n = len(df)
    values = df["value"].to_numpy()
    out: dict[str, list[float | None]] = {name: [None] * n for name in model_names}

    for i in range(1, n):
        X_train, y_train = build_adaptive_train_matrix(df, i)
        X_pred = build_adaptive_target_features(df, i)
        if len(X_train) < min_train_rows or X_pred is None:
            fallback = round(float(values[i - 1]), 2)
            for name in model_names:
                out[name][i] = fallback
            continue

        for name in model_names:
            try:
                sklearn_model = _make_sklearn_model(name)
                sklearn_model.fit(X_train, y_train)
                out[name][i] = round(float(sklearn_model.predict(X_pred)[0]), 2)
            except Exception:
                out[name][i] = round(float(values[i - 1]), 2)

    return out


def _resolve_model_names(model: str) -> list[str] | None:
    names = list(SKLEARN_MODEL_NAMES)
    if _HAS_LIGHTGBM and "lightgbm" not in names:
        names.append("lightgbm")

    if model == "compare":
        return names
    if model in names:
        return [model]
    return None


def _build_response(
    best_model_name: str,
    best_mase: float,
    df: pd.DataFrame,
    n: int,
    bt: int,
    acts_bt: list[float],
    dates_bt: list[str],
    preds_bt_dict: dict[str, list[float]],
    model_results: dict[str, dict[str, Any]],
    model_names: list[str],
    naive_mae: float,
    values: np.ndarray,
    backtest_days: int,
) -> dict[str, Any]:
    X_full, y_full = build_feature_matrix(df)
    final_model = _make_final_model(best_model_name)
    final_model.fit(X_full, y_full)
    X_next = build_next_features(df)
    if X_next is None:
        return {
            "error": f"Could not build next-day features for {best_model_name}",
            "model_name": best_model_name,
        }

    forecast = max(0.0, float(final_model.predict(X_next)[0]))
    best_preds = model_results[best_model_name]["preds"]
    residuals = np.abs(np.array(acts_bt) - best_preds)

    q50 = float(np.quantile(residuals, 0.5))
    q80 = float(np.quantile(residuals, 0.8))

    fc_int = int(round(forecast))
    band_low = max(0, int(round(forecast - q80)))
    band_high = int(round(forecast + q80))

    backtest_series = [
        {
            "date": dates_bt[k],
            "actual": round(float(acts_bt[k]), 2),
            "predicted": round(float(preds_bt_dict[best_model_name][k]), 2),
        }
        for k in range(len(acts_bt))
    ]

    last_date = pd.to_datetime(df["date"].iloc[-1])
    next_date = (last_date + pd.Timedelta(days=1)).strftime("%Y-%m-%d")

    if best_mase < 0.8:
        mode, confidence = "model", "alta"
        label = f"Forecast {best_model_name} favorable (MASE: {best_mase})"
    elif best_mase < 1.0:
        mode, confidence = "weak_model", "media"
        label = f"Forecast {best_model_name} orientativo (MASE: {best_mase})"
    else:
        mode, confidence = "observed_fallback", "baja"
        label = f"{best_model_name} no supera baseline estacional (MASE: {best_mase})"

    full_history = _build_full_history_series(df, model_names)

    models_list = []
    for name in model_names:
        fc_int = None
        horizons = None
        try:
            final_m = _make_final_model(name)
            final_m.fit(X_full, y_full)
            model_fc = max(0.0, float(final_m.predict(X_next)[0]))
            fc_int = int(round(model_fc))
            res = np.abs(np.array(acts_bt) - model_results[name]["preds"])
            q50 = float(np.quantile(res, 0.5)) if len(res) else 0.0
            q80 = float(np.quantile(res, 0.8)) if len(res) else 0.0
            horizons = {
                "next_1d": {
                    "forecast": fc_int,
                    "band_low": max(0, int(round(model_fc - q80))),
                    "band_high": int(round(model_fc + q80)),
                    "method": name,
                },
                "next_7d": {
                    "forecast": fc_int * 7,
                    "band_low": max(0, int(round((model_fc - q80) * 7))),
                    "band_high": int(round((model_fc + q80) * 7)),
                    "method": f"{name}+scale",
                },
                "next_14d": {
                    "forecast": fc_int * 14,
                    "band_low": max(0, int(round((model_fc - q80) * 14))),
                    "band_high": int(round((model_fc + q80) * 14)),
                    "method": f"{name}+scale",
                },
            }
        except Exception:
            pass

        entry: dict[str, Any] = {
            "name": name,
            "mae": model_results[name]["mae"],
            "mase": model_results[name]["mase"],
            "rmse": model_results[name]["rmse"],
            "series": full_history[name],
        }
        if fc_int is not None:
            entry["forecast_1d"] = fc_int
        if horizons is not None:
            entry["horizons"] = horizons
        models_list.append(entry)

    naive_series_aligned = [None] * n
    for i in range(7, n):
        naive_series_aligned[i] = float(values[i - 7])

    models_list.append({
        "name": "seasonal_naive",
        "mae": round(naive_mae, 2),
        "mase": 1.0,
        "rmse": round(naive_mae * 1.2, 2),
        "series": naive_series_aligned,
    })
    models_list.sort(key=lambda x: x["mase"])

    all_mase = {name: model_results[name]["mase"] for name in model_names}

    return {
        "model_name": best_model_name,
        "recommended_value": fc_int,
        "mase": best_mase,
        "confidence": confidence,
        "mode": mode,
        "label": label,
        "backtest": {
            "window_days": backtest_days,
            "naive_mae": round(naive_mae, 2),
            "models": models_list,
            "selected": best_model_name,
        },
        "forecast_horizons": {
            "next_1d": {
                "forecast": fc_int,
                "band_low": band_low,
                "band_high": band_high,
                "method": best_model_name,
            },
            "next_7d": {
                "forecast": fc_int * 7,
                "band_low": max(0, int(round((forecast - q80) * 7))),
                "band_high": int(round((forecast + q80) * 7)),
                "method": f"{best_model_name}+scale",
            },
            "next_14d": {
                "forecast": fc_int * 14,
                "band_low": max(0, int(round((forecast - q80) * 14))),
                "band_high": int(round((forecast + q80) * 14)),
                "method": f"{best_model_name}+scale",
            },
        },
        "intervals": {
            "band_50": {
                "low": max(0, int(round(forecast - q50))),
                "high": int(round(forecast + q50)),
            },
            "band_80": {"low": band_low, "high": band_high},
            "residual_points": len(residuals),
        },
        "backtest_series": backtest_series,
        "next_point": {
            "date": next_date,
            "forecast": fc_int,
            "band_low": band_low,
            "band_high": band_high,
        },
        "diagnostics": {
            "total_history_days": n,
            "backtest_days": bt,
            "best_model": best_model_name,
            "best_mase": best_mase,
            "compared_models": model_names,
            "all_mase": all_mase,
        },
    }


def run_forecast(
    series: list[dict],
    backtest_days: int = 14,
    min_points: int = 21,
    model: str = "compare",
    changepoint: dict[str, Any] | None = None,
) -> dict[str, Any]:
    df = series_to_dataframe(series, changepoint)
    n = len(df)
    if n < min_points:
        return {
            "error": f"Need at least {min_points} daily points, got {n}",
            "model_name": model,
        }

    model_names = _resolve_model_names(model)
    if not model_names:
        return {"error": f"Unknown model: {model}", "model_name": model}

    values = df["value"].to_numpy()
    bt = min(backtest_days, n - 15)
    bt = max(bt, 0)

    preds_bt_dict: dict[str, list[float]] = {name: [] for name in model_names}
    acts_bt: list[float] = []
    dates_bt: list[str] = []

    for i in range(n - bt, n):
        train_df = df.iloc[:i].copy()
        X_train, y_train = build_feature_matrix(train_df)
        if len(X_train) < 10:
            continue
        row_df = df.iloc[: i + 1]
        X_next = build_next_features(row_df)
        if X_next is None:
            continue

        acts_bt.append(float(values[i]))
        dates_bt.append(str(df["date"].iloc[i]))

        for name in model_names:
            try:
                sklearn_model = _make_sklearn_model(name)
                sklearn_model.fit(X_train, y_train)
                p = float(sklearn_model.predict(X_next)[0])
                preds_bt_dict[name].append(p)
            except Exception:
                preds_bt_dict[name].append(float("nan"))

    if not acts_bt:
        return {"error": "Backtest produced no predictions", "model_name": model}

    act_a = np.array(acts_bt)
    naive_mae = _seasonal_naive_mae(act_a, values[n - bt - 7 : n])

    model_results: dict[str, dict[str, Any]] = {}
    for name in model_names:
        pred_a = np.array(preds_bt_dict[name])
        valid = pred_a[~np.isnan(pred_a)]
        if len(valid) == 0:
            continue
        m = _metrics(act_a, pred_a)
        mase = round(m["mae"] / naive_mae, 4) if naive_mae > 0 else 999.0
        model_results[name] = {
            "mae": m["mae"],
            "rmse": m["rmse"],
            "mase": mase,
            "preds": pred_a,
        }

    if not model_results:
        return {"error": "No ML models produced valid forecasts", "model_name": model}

    best_model_name = min(model_results.keys(), key=lambda k: model_results[k]["mase"])
    best_mase = model_results[best_model_name]["mase"]

    return _build_response(
        best_model_name,
        best_mase,
        df,
        n,
        bt,
        acts_bt,
        dates_bt,
        preds_bt_dict,
        model_results,
        list(model_results.keys()),
        naive_mae,
        values,
        backtest_days,
    )
