"""Forecasting models with rolling backtest, MASE, and model comparison."""

from __future__ import annotations

import math
from typing import Any, Callable

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.linear_model import Ridge
from sklearn.neural_network import MLPRegressor

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

    model_names = ["random_forest", "gradient_boosting", "ridge", "mlp_neural_network"]
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
            if name == "random_forest":
                model = RandomForestRegressor(
                    n_estimators=80,
                    max_depth=8,
                    min_samples_leaf=2,
                    random_state=42,
                    n_jobs=-1,
                )
            elif name == "gradient_boosting":
                model = GradientBoostingRegressor(
                    n_estimators=80,
                    max_depth=5,
                    min_samples_leaf=2,
                    random_state=42,
                )
            elif name == "ridge":
                model = Ridge(alpha=1.0)
            elif name == "mlp_neural_network":
                model = MLPRegressor(
                    hidden_layer_sizes=(50, 25),
                    max_iter=500,
                    random_state=42,
                )

            model.fit(X_train, y_train)
            p = float(model.predict(X_next)[0])
            preds_bt_dict[name].append(p)

    if not acts_bt:
        return {"error": "Backtest produced no predictions", "model_name": "random_forest"}

    act_a = np.array(acts_bt)
    naive_mae = _seasonal_naive_mae(act_a, values[n - bt - 7 : n])

    model_results = {}
    for name in model_names:
        pred_a = np.array(preds_bt_dict[name])
        m = _metrics(act_a, pred_a)
        mase = round(m["mae"] / naive_mae, 4) if naive_mae > 0 else 999.0
        model_results[name] = {
            "mae": m["mae"],
            "rmse": m["rmse"],
            "mase": mase,
            "preds": pred_a,
        }

    # Select best model based on MASE
    best_model_name = min(model_results.keys(), key=lambda k: model_results[k]["mase"])
    best_mase = model_results[best_model_name]["mase"]

    X_full, y_full = build_feature_matrix(df)
    if best_model_name == "random_forest":
        final_model = RandomForestRegressor(
            n_estimators=100,
            max_depth=8,
            min_samples_leaf=2,
            random_state=42,
            n_jobs=-1,
        )
    elif best_model_name == "gradient_boosting":
        final_model = GradientBoostingRegressor(
            n_estimators=100,
            max_depth=5,
            min_samples_leaf=2,
            random_state=42,
        )
    elif best_model_name == "ridge":
        final_model = Ridge(alpha=1.0)
    elif best_model_name == "mlp_neural_network":
        final_model = MLPRegressor(
            hidden_layer_sizes=(50, 25),
            max_iter=500,
            random_state=42,
        )

    final_model.fit(X_full, y_full)
    X_next = build_next_features(df)
    if X_next is None:
        return {"error": f"Could not build next-day features for {best_model_name}", "model_name": best_model_name}

    forecast = max(0.0, float(final_model.predict(X_next)[0]))
    best_preds = model_results[best_model_name]["preds"]
    residuals = np.abs(act_a - best_preds)

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
    next_point = {
        "date": next_date,
        "forecast": fc_int,
        "band_low": band_low,
        "band_high": band_high,
    }

    if best_mase < 0.8:
        mode, confidence = "model", "alta"
        label = f"Forecast {best_model_name} favorable (MASE: {best_mase})"
    elif best_mase < 1.0:
        mode, confidence = "weak_model", "media"
        label = f"Forecast {best_model_name} orientativo (MASE: {best_mase})"
    else:
        mode, confidence = "observed_fallback", "baja"
        label = f"{best_model_name} no supera baseline estacional (MASE: {best_mase})"

    models_list = []
    for name in model_names:
        series_aligned = [None] * n
        for k in range(len(acts_bt)):
            idx = n - bt + k
            series_aligned[idx] = round(float(preds_bt_dict[name][k]), 2)

        models_list.append({
            "name": name,
            "mae": model_results[name]["mae"],
            "mase": model_results[name]["mase"],
            "rmse": model_results[name]["rmse"],
            "series": series_aligned,
        })

    naive_series_aligned = [None] * n
    for k in range(len(acts_bt)):
        idx = n - bt + k
        naive_series_aligned[idx] = float(values[idx - 7]) if idx >= 7 else None

    models_list.append({
        "name": "seasonal_naive",
        "mae": round(naive_mae, 2),
        "mase": 1.0,
        "rmse": round(naive_mae * 1.2, 2),
        "series": naive_series_aligned,
    })
    models_list.sort(key=lambda x: x["mase"])

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
            "total_history_days": n,
            "backtest_days": bt,
            "best_model": best_model_name,
            "best_mase": best_mase,
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
