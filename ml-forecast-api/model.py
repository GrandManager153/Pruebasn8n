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
ENSEMBLE_MAX_MODELS = 3
ENSEMBLE_CLOSE_RATIO = 1.25
ENSEMBLE_MAX_MASE = 1.5
MIN_ENSEMBLE_GAIN = 0.005  # ensemble must beat best single by >= 0.005 MASE


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


def _format_short_es(date_str: str) -> str:
    dt = pd.to_datetime(date_str)
    months = ("ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic")
    return f"{dt.day:02d} {months[dt.month - 1]}"


def _resolve_forecast_target(
    last_complete_date: str,
    target_date: str,
    reference_date: str | None = None,
) -> dict[str, Any]:
    last_key = str(last_complete_date).split("T")[0]
    target_key = str(target_date).split("T")[0]
    ref_key = str(reference_date).split("T")[0] if reference_date else None

    horizon_offset = 1
    if ref_key:
        horizon_offset = (pd.to_datetime(target_key) - pd.to_datetime(ref_key)).days

    label_short = "Mañana"
    label_card = "Pronóstico de mañana"
    label_kpi = "Pronóstico de Mañana"
    explanation_es = (
        "Predicción de leads para el día siguiente al último dato completo en la serie."
    )

    if horizon_offset == 0:
        label_short = "Hoy"
        label_card = "Pronóstico de hoy"
        label_kpi = "Pronóstico de Hoy"
        explanation_es = (
            "Predicción de leads para hoy, usando datos completos hasta el último día cerrado en la serie."
        )
    elif horizon_offset == 1:
        pass
    else:
        fmt = _format_short_es(target_key)
        label_short = fmt
        label_card = f"Pronóstico {fmt}"
        label_kpi = f"Pronóstico {fmt}"
        explanation_es = (
            f"Predicción de leads para el {fmt}, usando datos completos hasta el último día cerrado en la serie."
        )

    last_fmt = _format_short_es(last_key)
    subtext = f"Basado en datos completos hasta el {last_fmt}"

    return {
        "last_complete_date": last_key,
        "target_date": target_key,
        "reference_date": ref_key,
        "horizon_offset": horizon_offset,
        "label_short": label_short,
        "label_card": label_card,
        "label_kpi": label_kpi,
        "label_chart": _format_short_es(target_key),
        "subtext": subtext,
        "explanation_es": explanation_es,
        "timezone": "America/Mexico_City",
    }


def _mase_from_pred_array(
    act_a: np.ndarray,
    pred_a: np.ndarray,
    naive_mae: float,
) -> tuple[float, np.ndarray]:
    pred_a = np.array(pred_a, dtype=float)
    valid = ~np.isnan(pred_a)
    if not valid.any():
        return 999.0, pred_a
    m = _metrics(act_a[valid], pred_a[valid])
    mase = round(m["mae"] / naive_mae, 4) if naive_mae > 0 else 999.0
    return mase, pred_a


def _next_day_predictions(df: pd.DataFrame, model_names: list[str]) -> dict[str, float]:
    X_full, y_full = build_feature_matrix(df)
    X_next = build_next_features(df)
    if X_next is None:
        return {}

    out: dict[str, float] = {}
    for name in model_names:
        try:
            final_m = _make_final_model(name)
            final_m.fit(X_full, y_full)
            out[name] = max(0.0, float(final_m.predict(X_next)[0]))
        except Exception:
            continue
    return out


def _combine_next_day_forecast(strategy: dict[str, Any], next_preds: dict[str, float]) -> float | None:
    if not next_preds:
        return None

    if strategy["type"] == "single":
        name = strategy["components"][0]
        return next_preds.get(name)

    if strategy["type"] == "ensemble_weighted":
        total = 0.0
        weight_sum = 0.0
        for name, weight in (strategy.get("weights") or {}).items():
            if name in next_preds:
                total += weight * next_preds[name]
                weight_sum += weight
        if weight_sum <= 0:
            return None
        return max(0.0, total / weight_sum)

    meta = strategy.get("meta")
    if meta is None:
        return None
    row = np.array([[next_preds.get(name, 0.0) for name in strategy["components"]]])
    return max(0.0, float(meta.predict(row)[0]))


def _build_ensemble_history_series(
    full_history: dict[str, list[float | None]],
    strategy: dict[str, Any],
) -> list[float | None]:
    components = strategy["components"]
    if not components:
        return []

    length = max(len(full_history.get(name) or []) for name in components)
    blended: list[float | None] = [None] * length

    for idx in range(length):
        vals: list[float] = []
        weights: list[float] = []

        if strategy["type"] == "ensemble_stacking" and strategy.get("meta") is not None:
            row_vals = []
            for name in components:
                series = full_history.get(name) or []
                if idx >= len(series) or series[idx] is None:
                    row_vals = []
                    break
                row_vals.append(float(series[idx]))
            if len(row_vals) == len(components):
                blended[idx] = round(
                    max(0.0, float(strategy["meta"].predict(np.array([row_vals]))[0])),
                    2,
                )
            continue

        for name in components:
            series = full_history.get(name) or []
            if idx >= len(series) or series[idx] is None:
                continue
            weight = 1.0
            if strategy["type"] == "ensemble_weighted":
                weight = float((strategy.get("weights") or {}).get(name, 0.0))
                if weight <= 0:
                    continue
            vals.append(float(series[idx]))
            weights.append(weight)

        if vals and weights and sum(weights) > 0:
            blended[idx] = round(sum(v * w for v, w in zip(vals, weights)) / sum(weights), 2)

    return blended


def _select_forecast_strategy(
    model_results: dict[str, dict[str, Any]],
    preds_bt_dict: dict[str, list[float]],
    acts_bt: list[float],
    naive_mae: float,
) -> dict[str, Any]:
    act_a = np.array(acts_bt, dtype=float)
    ranked = sorted(model_results.items(), key=lambda kv: kv[1]["mase"])
    best_name, best_res = ranked[0]
    best_mase = float(best_res["mase"])

    single_strategy: dict[str, Any] = {
        "type": "single",
        "model": best_name,
        "mase": best_mase,
        "preds": np.array(best_res["preds"], dtype=float),
        "components": [best_name],
        "weights": None,
        "meta": None,
        "candidates_evaluated": [],
    }

    candidates: list[str] = []
    for name, res in ranked:
        mase = float(res["mase"])
        if mase > ENSEMBLE_MAX_MASE:
            continue
        if mase > best_mase * ENSEMBLE_CLOSE_RATIO:
            continue
        candidates.append(name)
        if len(candidates) >= ENSEMBLE_MAX_MODELS:
            break

    if len(candidates) < 2:
        return single_strategy

    ensemble_candidates: list[dict[str, Any]] = []

    inv = np.array([1.0 / max(float(model_results[name]["mase"]), 0.01) for name in candidates])
    weights_arr = inv / inv.sum()
    weighted_pred = np.zeros(len(act_a), dtype=float)
    for idx, name in enumerate(candidates):
        weighted_pred += weights_arr[idx] * np.array(preds_bt_dict[name], dtype=float)
    weighted_mase, weighted_pred = _mase_from_pred_array(act_a, weighted_pred, naive_mae)
    ensemble_candidates.append({
        "type": "ensemble_weighted",
        "model": "ensemble_ml_weighted",
        "mase": weighted_mase,
        "preds": weighted_pred,
        "components": candidates,
        "weights": {name: round(float(weights_arr[i]), 4) for i, name in enumerate(candidates)},
        "meta": None,
    })

    try:
        stack_matrix = np.column_stack([
            np.array(preds_bt_dict[name], dtype=float) for name in candidates
        ])
        if not np.isnan(stack_matrix).any():
            meta = Ridge(alpha=1.0)
            meta.fit(stack_matrix, act_a)
            stack_pred = np.maximum(meta.predict(stack_matrix), 0.0)
            stack_mase, stack_pred = _mase_from_pred_array(act_a, stack_pred, naive_mae)
            ensemble_candidates.append({
                "type": "ensemble_stacking",
                "model": "ensemble_ml_stacking",
                "mase": stack_mase,
                "preds": stack_pred,
                "components": candidates,
                "weights": None,
                "meta": meta,
            })
    except Exception:
        pass

    single_strategy["candidates_evaluated"] = [
        {"model": c["model"], "mase": c["mase"], "components": c["components"]}
        for c in ensemble_candidates
    ]

    if not ensemble_candidates:
        return single_strategy

    best_ensemble = min(ensemble_candidates, key=lambda item: item["mase"])
    if float(best_ensemble["mase"]) <= best_mase - MIN_ENSEMBLE_GAIN:
        return best_ensemble

    single_strategy["selection_note"] = (
        f"Ensemble {best_ensemble['model']} ({best_ensemble['mase']}) "
        f"no supera a {best_name} ({best_mase}) por >= {MIN_ENSEMBLE_GAIN} MASE"
    )
    return single_strategy


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
    strategy: dict[str, Any],
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
    best_model_name = strategy["model"]
    best_mase = float(strategy["mase"])
    best_preds = np.array(strategy["preds"], dtype=float)

    next_preds = _next_day_predictions(df, strategy["components"])
    forecast_raw = _combine_next_day_forecast(strategy, next_preds)
    if forecast_raw is None:
        return {
            "error": f"Could not build next-day forecast for {best_model_name}",
            "model_name": best_model_name,
        }

    forecast = float(forecast_raw)
    residuals = np.abs(np.array(acts_bt, dtype=float) - best_preds)

    q50 = float(np.quantile(residuals, 0.5))
    q80 = float(np.quantile(residuals, 0.8))

    fc_int = int(round(forecast))
    band_low = max(0, int(round(forecast - q80)))
    band_high = int(round(forecast + q80))

    backtest_series = [
        {
            "date": dates_bt[k],
            "actual": round(float(acts_bt[k]), 2),
            "predicted": round(float(best_preds[k]), 2),
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
    X_full, y_full = build_feature_matrix(df)
    X_next = build_next_features(df)
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

    if strategy["type"] != "single":
        ens_series = _build_ensemble_history_series(full_history, strategy)
        ens_entry: dict[str, Any] = {
            "name": best_model_name,
            "mae": round(float(np.mean(np.abs(np.array(acts_bt) - best_preds))), 2),
            "mase": best_mase,
            "rmse": round(float(np.sqrt(np.mean((np.array(acts_bt) - best_preds) ** 2))), 2),
            "series": ens_series,
            "forecast_1d": fc_int,
            "components": strategy["components"],
        }
        if strategy.get("weights"):
            ens_entry["ensemble_weights"] = strategy["weights"]
        models_list.append(ens_entry)

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
    best_single_name = min(model_results.keys(), key=lambda k: model_results[k]["mase"])
    best_single_mase = float(model_results[best_single_name]["mase"])

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
            "ensemble_weights": strategy.get("weights"),
            "ensemble_components": strategy.get("components"),
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
        "forecast_target": _resolve_forecast_target(
            last_date.strftime("%Y-%m-%d"),
            next_date,
        ),
        "diagnostics": {
            "total_history_days": n,
            "backtest_days": test_count,
            "train_test_split": split_meta,
            "best_model": best_model_name,
            "best_mase": best_mase,
            "best_single_model": best_single_name,
            "best_single_mase": best_single_mase,
            "ensemble_used": strategy["type"] != "single",
            "ensemble_type": strategy["type"],
            "ensemble_components": strategy.get("components"),
            "ensemble_weights": strategy.get("weights"),
            "ensemble_candidates": strategy.get("candidates_evaluated"),
            "selection_note": strategy.get("selection_note"),
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

    strategy = _select_forecast_strategy(
        model_results,
        preds_bt_dict,
        acts_bt,
        naive_mae,
    )

    return _build_response(
        strategy,
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
