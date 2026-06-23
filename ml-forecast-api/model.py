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

TRAIN_RATIO = 0.7
MIN_TEST_DAYS = 14


def _compute_train_test_split(n: int, dates: list[str] | None = None) -> dict[str, Any] | None:
    if n < MIN_TEST_DAYS + 1:
        return None
    train_count = int(math.floor(n * TRAIN_RATIO))
    test_count = n - train_count
    if test_count < MIN_TEST_DAYS:
        train_count = n - MIN_TEST_DAYS
        test_count = MIN_TEST_DAYS
    if train_count < 1:
        return None
    split_index = train_count
    split_date = None
    if dates and split_index < len(dates):
        split_date = str(dates[split_index]).split("T")[0]
    return {
        "train_count": train_count,
        "test_count": test_count,
        "split_index": split_index,
        "split_date": split_date,
        "train_ratio": round(train_count / n, 3),
        "test_ratio": round(test_count / n, 3),
        "min_test_days": MIN_TEST_DAYS,
        "total_days": n,
    }


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


def _build_holdout_series(
    df: pd.DataFrame,
    model_names: list[str],
    split_index: int,
) -> dict[str, list[float | None]]:
    """In-sample train predictions + frozen-model OOS test predictions."""
    n = len(df)
    train_df = df.iloc[:split_index]
    out: dict[str, list[float | None]] = {name: [None] * n for name in model_names}
    fitted: dict[str, Any] = {}

    for name in model_names:
        try:
            X_train, y_train = build_feature_matrix(train_df)
            if len(X_train) < 2:
                continue
            model = _make_sklearn_model(name)
            model.fit(X_train, y_train)
            fitted[name] = model

            # Train zone: in-sample + adaptive features (dense coverage from index 1)
            for idx in range(1, split_index):
                X_pred = build_adaptive_target_features(train_df, idx)
                if X_pred is None:
                    continue
                try:
                    out[name][idx] = round(float(model.predict(X_pred)[0]), 2)
                except Exception:
                    pass
        except Exception:
            continue

    for name, model in fitted.items():
        for idx in range(split_index, n):
            row_df = df.iloc[: idx + 1]
            X_pred = build_next_features(row_df)
            if X_pred is None:
                X_pred = build_adaptive_target_features(df, idx)
            if X_pred is not None:
                try:
                    out[name][idx] = round(float(model.predict(X_pred)[0]), 2)
                except Exception:
                    pass

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
    split_meta: dict[str, Any],
    acts_bt: list[float],
    dates_bt: list[str],
    preds_bt_dict: dict[str, list[float]],
    model_results: dict[str, dict[str, Any]],
    model_names: list[str],
    naive_mae: float,
    values: np.ndarray,
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

    full_history = _build_holdout_series(df, model_names, split_meta["split_index"])

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
    split_index = split_meta["split_index"]
    for i in range(split_index, n):
        if i >= 7:
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
    test_count = split_meta["test_count"]

    return {
        "model_name": best_model_name,
        "recommended_value": fc_int,
        "mase": best_mase,
        "confidence": confidence,
        "mode": mode,
        "label": label,
        "train_test_split": split_meta,
        "backtest": {
            "window_days": test_count,
            "naive_mae": round(naive_mae, 2),
            "models": models_list,
            "selected": best_model_name,
            "train_test_split": split_meta,
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
            "backtest_days": test_count,
            "train_test_split": split_meta,
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
    dates = [str(d) for d in df["date"].tolist()]
    split_meta = _compute_train_test_split(n, dates)
    if not split_meta:
        return {
            "error": f"Need at least {MIN_TEST_DAYS + 1} daily points for train/test split, got {n}",
            "model_name": model,
        }

    split_index = split_meta["split_index"]
    preds_bt_dict: dict[str, list[float]] = {name: [] for name in model_names}
    acts_bt: list[float] = []
    dates_bt: list[str] = []

    train_df = df.iloc[:split_index]
    X_train, y_train = build_feature_matrix(train_df)
    if len(X_train) < 10:
        return {"error": "Insufficient training rows after split", "model_name": model}

    fitted_models: dict[str, Any] = {}
    for name in model_names:
        try:
            sklearn_model = _make_sklearn_model(name)
            sklearn_model.fit(X_train, y_train)
            fitted_models[name] = sklearn_model
        except Exception:
            continue

    if not fitted_models:
        return {"error": "No ML models could be trained on holdout split", "model_name": model}

    for i in range(split_index, n):
        row_df = df.iloc[: i + 1]
        X_next = build_next_features(row_df)
        if X_next is None:
            X_next = build_adaptive_target_features(df, i)
        if X_next is None:
            continue

        acts_bt.append(float(values[i]))
        dates_bt.append(str(df["date"].iloc[i]))

        for name in model_names:
            if name not in fitted_models:
                preds_bt_dict[name].append(float("nan"))
                continue
            try:
                p = float(fitted_models[name].predict(X_next)[0])
                preds_bt_dict[name].append(p)
            except Exception:
                preds_bt_dict[name].append(float("nan"))

    if not acts_bt:
        return {"error": "Holdout backtest produced no predictions", "model_name": model}

    act_a = np.array(acts_bt)
    naive_mae = _seasonal_naive_mae(act_a, values[max(0, split_index - 7) : n])

    model_results: dict[str, dict[str, Any]] = {}
    for name in model_names:
        if name not in fitted_models:
            continue
        pred_a = np.array(preds_bt_dict[name])
        valid_mask = ~np.isnan(pred_a)
        if not valid_mask.any():
            continue
        m = _metrics(act_a[valid_mask], pred_a[valid_mask])
        mase = round(m["mae"] / naive_mae, 4) if naive_mae > 0 else 999.0
        model_results[name] = {
            "mae": m["mae"],
            "rmse": m["rmse"],
            "mase": mase,
            "preds": pred_a,
        }

    if not model_results:
        return {"error": "No ML models produced valid holdout forecasts", "model_name": model}

    best_model_name = min(model_results.keys(), key=lambda k: model_results[k]["mase"])
    best_mase = model_results[best_model_name]["mase"]

    return _build_response(
        best_model_name,
        best_mase,
        df,
        n,
        split_meta,
        acts_bt,
        dates_bt,
        preds_bt_dict,
        model_results,
        list(model_results.keys()),
        naive_mae,
        values,
    )
