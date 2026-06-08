"""Forecasting models with rolling backtest, MASE, and model comparison."""

from __future__ import annotations

import math
from typing import Any, Callable

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor

from features import (
    build_backtest_target_features,
    build_backtest_train_matrix,
    build_feature_matrix,
    build_next_features,
    series_to_dataframe,
)

try:
    import lightgbm as lgb

    _HAS_LIGHTGBM = True
except ImportError:
    _HAS_LIGHTGBM = False

try:
    from statsmodels.tsa.holtwinters import ExponentialSmoothing

    _HAS_STATSMODELS = True
except ImportError:
    _HAS_STATSMODELS = False


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


def _confidence_from_mase(mase: float, model_label: str) -> tuple[str, str, str]:
    if mase < 0.8:
        return "model", "alta", f"Forecast {model_label} favorable (MASE: {mase})"
    if mase < 1.0:
        return "weak_model", "media", f"Forecast {model_label} orientativo (MASE: {mase})"
    return "observed_fallback", "baja", f"{model_label} no supera baseline estacional (MASE: {mase})"


def _make_sklearn_model(model_name: str):
    if model_name == "random_forest":
        return RandomForestRegressor(
            n_estimators=100,
            max_depth=8,
            min_samples_leaf=2,
            random_state=42,
            n_jobs=-1,
        )
    if model_name == "lightgbm":
        if not _HAS_LIGHTGBM:
            raise RuntimeError("lightgbm not installed")
        return lgb.LGBMRegressor(
            n_estimators=120,
            max_depth=8,
            learning_rate=0.08,
            num_leaves=31,
            random_state=42,
            verbose=-1,
        )
    raise ValueError(f"Unknown model: {model_name}")


def _rolling_ml_backtest(
    df: pd.DataFrame,
    model_name: str,
    backtest_days: int,
) -> tuple[list[dict[str, Any]], dict[str, float], float]:
    values = df["value"].to_numpy()
    n = len(values)
    bt = min(backtest_days, n - 15)
    bt = max(bt, 0)
    min_train_rows = 10

    backtest_rows: list[dict[str, Any]] = []
    for i in range(n):
        if i == 0:
            backtest_rows.append(
                {
                    "date": str(df["date"].iloc[i]),
                    "actual": round(float(values[i]), 2),
                    "predicted": round(float(values[i]), 2),
                }
            )
            continue

        X_train, y_train = build_backtest_train_matrix(df, i)
        if len(X_train) < min_train_rows:
            fallback = float(values[i - 1])
            backtest_rows.append(
                {
                    "date": str(df["date"].iloc[i]),
                    "actual": round(float(values[i]), 2),
                    "predicted": round(fallback, 2),
                }
            )
            continue

        X_next = build_backtest_target_features(df, i)
        if X_next is None:
            continue

        model = _make_sklearn_model(model_name)
        model.fit(X_train, y_train)
        pred = max(0.0, float(model.predict(X_next)[0]))
        backtest_rows.append(
            {
                "date": str(df["date"].iloc[i]),
                "actual": round(float(values[i]), 2),
                "predicted": round(pred, 2),
            }
        )

    if not backtest_rows:
        return [], {"mae": 999.0, "rmse": 999.0}, 999.0

    mase_rows = backtest_rows[-bt:] if bt else backtest_rows
    act_a = np.array([row["actual"] for row in mase_rows], dtype=float)
    pred_a = np.array([row["predicted"] for row in mase_rows], dtype=float)
    m = _metrics(act_a, pred_a)
    hist_start = max(0, len(values) - bt - 7)
    naive_mae = _seasonal_naive_mae(act_a, values[hist_start : len(values)])
    mase = round(m["mae"] / naive_mae, 4) if naive_mae > 0 else 999.0
    return backtest_rows, m, mase


def _autoets_predict(train_values: np.ndarray) -> float:
    if len(train_values) < 14:
        return float(train_values[-1])
    if not _HAS_STATSMODELS:
        return float(np.mean(train_values[-7:]))
    try:
        seasonal = len(train_values) >= 21
        if seasonal:
            fitted = ExponentialSmoothing(
                train_values,
                trend="add",
                seasonal="add",
                seasonal_periods=7,
                initialization_method="estimated",
            ).fit(optimized=True)
        else:
            fitted = ExponentialSmoothing(
                train_values,
                trend="add",
                seasonal=None,
                initialization_method="estimated",
            ).fit(optimized=True)
        return max(0.0, float(fitted.forecast(1)[0]))
    except Exception:
        return float(np.mean(train_values[-7:]))


def _rolling_autoets_backtest(
    df: pd.DataFrame,
    backtest_days: int,
) -> tuple[list[dict[str, Any]], dict[str, float], float]:
    values = df["value"].to_numpy()
    n = len(values)
    bt = min(backtest_days, n - 15)
    bt = max(bt, 0)
    min_train = 14

    backtest_rows: list[dict[str, Any]] = []
    for i in range(n):
        if i < min_train:
            pred = float(values[i - 1]) if i > 0 else float(values[0])
        else:
            pred = _autoets_predict(values[:i])
        backtest_rows.append(
            {
                "date": str(df["date"].iloc[i]),
                "actual": round(float(values[i]), 2),
                "predicted": round(pred, 2),
            }
        )

    mase_rows = backtest_rows[-bt:] if bt else backtest_rows
    act_a = np.array([row["actual"] for row in mase_rows], dtype=float)
    pred_a = np.array([row["predicted"] for row in mase_rows], dtype=float)
    m = _metrics(act_a, pred_a)
    hist_start = max(0, len(values) - bt - 7)
    naive_mae = _seasonal_naive_mae(act_a, values[hist_start : len(values)])
    mase = round(m["mae"] / naive_mae, 4) if naive_mae > 0 else 999.0
    return backtest_rows, m, mase


def _build_response(
    model_name: str,
    df: pd.DataFrame,
    backtest_rows: list[dict[str, Any]],
    metrics: dict[str, float],
    mase: float,
    forecast_value: float,
    backtest_days: int,
    all_models: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    mase_rows = backtest_rows[-backtest_days:] if backtest_days else backtest_rows
    act_a = np.array([row["actual"] for row in mase_rows], dtype=float)
    pred_a = np.array([row["predicted"] for row in mase_rows], dtype=float)
    residuals = np.abs(act_a - pred_a)
    q50 = float(np.quantile(residuals, 0.5)) if len(residuals) else 0.0
    q80 = float(np.quantile(residuals, 0.8)) if len(residuals) else 0.0

    fc_int = int(round(forecast_value))
    band_low = max(0, int(round(forecast_value - q80)))
    band_high = int(round(forecast_value + q80))
    mode, confidence, label = _confidence_from_mase(mase, model_name.replace("_", " "))

    hist_start = max(0, len(df) - backtest_days - 7)
    naive_mae = _seasonal_naive_mae(
        act_a,
        df["value"].to_numpy()[hist_start : len(df)],
    )

    model_entries = all_models or [
        {
            "name": model_name,
            "mae": metrics["mae"],
            "mase": mase,
            "rmse": metrics["rmse"],
        }
    ]

    last_date = pd.to_datetime(df["date"].iloc[-1])
    next_date = (last_date + pd.Timedelta(days=1)).strftime("%Y-%m-%d")

    return {
        "model_name": model_name,
        "recommended_value": fc_int,
        "mase": mase,
        "confidence": confidence,
        "mode": mode,
        "label": label,
        "backtest": {
            "window_days": backtest_days,
            "naive_mae": round(naive_mae, 2),
            "models": model_entries
            + [
                {
                    "name": "seasonal_naive",
                    "mae": round(naive_mae, 2),
                    "mase": 1.0,
                    "rmse": round(naive_mae * 1.2, 2),
                }
            ],
            "selected": model_name,
        },
        "forecast_horizons": {
            "next_1d": {
                "forecast": fc_int,
                "band_low": band_low,
                "band_high": band_high,
                "method": model_name,
            },
            "next_7d": {
                "forecast": fc_int * 7,
                "band_low": max(0, int(round((forecast_value - q80) * 7))),
                "band_high": int(round((forecast_value + q80) * 7)),
                "method": f"{model_name}+scale",
            },
        },
        "intervals": {
            "band_50": {"low": max(0, int(round(forecast_value - q50))), "high": int(round(forecast_value + q50))},
            "band_80": {"low": band_low, "high": band_high},
            "residual_points": len(residuals),
        },
        "backtest_series": backtest_rows,
        "next_point": {
            "date": next_date,
            "forecast": fc_int,
            "band_low": band_low,
            "band_high": band_high,
        },
        "diagnostics": {
            "total_history_days": len(df),
            "backtest_days": backtest_days,
            "best_model": model_name,
            "best_mase": mase,
            "features_used": ["lags", "spend", "changepoint_recent"],
        },
    }


def _run_random_forest(df: pd.DataFrame, backtest_days: int) -> dict[str, Any]:
    backtest_rows, metrics, mase = _rolling_ml_backtest(df, "random_forest", backtest_days)
    if not backtest_rows:
        return {"error": "Backtest produced no predictions", "model_name": "random_forest"}

    X_full, y_full = build_feature_matrix(df)
    final_model = _make_sklearn_model("random_forest")
    final_model.fit(X_full, y_full)
    X_next = build_next_features(df)
    if X_next is None:
        return {"error": "Could not build next-day features", "model_name": "random_forest"}
    forecast = max(0.0, float(final_model.predict(X_next)[0]))
    return _build_response("random_forest", df, backtest_rows, metrics, mase, forecast, backtest_days)


def _run_lightgbm(df: pd.DataFrame, backtest_days: int) -> dict[str, Any]:
    if not _HAS_LIGHTGBM:
        return {"error": "lightgbm not installed", "model_name": "lightgbm"}
    backtest_rows, metrics, mase = _rolling_ml_backtest(df, "lightgbm", backtest_days)
    if not backtest_rows:
        return {"error": "Backtest produced no predictions", "model_name": "lightgbm"}

    X_full, y_full = build_feature_matrix(df)
    final_model = _make_sklearn_model("lightgbm")
    final_model.fit(X_full, y_full)
    X_next = build_next_features(df)
    if X_next is None:
        return {"error": "Could not build next-day features", "model_name": "lightgbm"}
    forecast = max(0.0, float(final_model.predict(X_next)[0]))
    return _build_response("lightgbm", df, backtest_rows, metrics, mase, forecast, backtest_days)


def _run_autoets(df: pd.DataFrame, backtest_days: int) -> dict[str, Any]:
    backtest_rows, metrics, mase = _rolling_autoets_backtest(df, backtest_days)
    if not backtest_rows:
        return {"error": "AutoETS backtest failed", "model_name": "autoets"}
    forecast = _autoets_predict(df["value"].to_numpy())
    return _build_response("autoets", df, backtest_rows, metrics, mase, forecast, backtest_days)


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

    bt = min(backtest_days, n - 15)
    bt = max(bt, 0)

    runners: dict[str, Callable[[pd.DataFrame, int], dict[str, Any]]] = {
        "random_forest": _run_random_forest,
        "lightgbm": _run_lightgbm,
        "autoets": _run_autoets,
    }

    if model == "compare":
        ml_names = ["random_forest", "lightgbm"]
        results: list[dict[str, Any]] = []
        for name in ml_names:
            try:
                result = runners[name](df, bt)
            except Exception as exc:
                result = {"error": str(exc), "model_name": name}
            if result.get("error"):
                continue
            results.append(result)

        if not results:
            return {"error": "No ML models produced valid forecasts", "model_name": "compare"}

        benchmark: dict[str, Any] | None = None
        try:
            benchmark = _run_autoets(df, bt)
        except Exception:
            benchmark = None
        if benchmark and benchmark.get("error"):
            benchmark = None

        best = min(results, key=lambda r: r["mase"])
        compare_models = []
        for r in sorted(results, key=lambda x: x["mase"]):
            ml_entry = next(
                (m for m in r["backtest"]["models"] if m["name"] == r["model_name"]),
                r["backtest"]["models"][0],
            )
            compare_models.append(ml_entry)
        if benchmark:
            compare_models.append(benchmark["backtest"]["models"][0])

        seasonal = next(
            (m for m in best["backtest"]["models"] if m["name"] == "seasonal_naive"),
            None,
        )
        best["backtest"]["models"] = compare_models + ([seasonal] if seasonal else [])

        all_mase = {r["model_name"]: r["mase"] for r in results}
        if benchmark:
            all_mase["autoets"] = benchmark["mase"]
        best["diagnostics"]["compared_models"] = ml_names + (["autoets"] if benchmark else [])
        best["diagnostics"]["all_mase"] = all_mase
        best["diagnostics"]["benchmark_autoets_mase"] = benchmark["mase"] if benchmark else None
        return best

    runner = runners.get(model)
    if not runner:
        return {"error": f"Unknown model: {model}", "model_name": model}
    return runner(df, bt)
