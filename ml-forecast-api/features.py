"""Feature engineering for daily lead volume forecasting."""

from __future__ import annotations

from typing import Any

import pandas as pd

BASE_FEATURE_COLS = ["dow", "lag_1", "lag_7", "lag_14", "rolling_mean_7"]
SPEND_FEATURE_COLS = ["spend", "spend_lag_1", "spend_lag_7", "spend_rolling_7"]
REGIME_FEATURE_COLS = ["changepoint_recent"]


def series_to_dataframe(
    series: list[dict],
    changepoint: dict[str, Any] | None = None,
) -> pd.DataFrame:
    rows = []
    for p in series:
        d = p.get("date") or p.get("fecha")
        v = p.get("value")
        if v is None:
            v = p.get("contactos")
        if d is None or v is None:
            continue
        spend = p.get("spend")
        if spend is None:
            spend = p.get("gasto")
        rows.append(
            {
                "date": str(d).split("T")[0],
                "value": float(v),
                "spend": float(spend) if spend is not None else 0.0,
            }
        )
    if not rows:
        return pd.DataFrame(columns=["date", "value", "spend", "dow"])

    df = pd.DataFrame(rows).drop_duplicates(subset=["date"]).sort_values("date")
    df["value"] = df["value"].astype(float)
    df["spend"] = df["spend"].fillna(0.0).astype(float)
    df["dow"] = pd.to_datetime(df["date"]).dt.dayofweek
    df = _apply_lag_features(df)
    df = _apply_spend_features(df)
    df["changepoint_recent"] = _changepoint_recent_series(df, changepoint)
    return df.reset_index(drop=True)


def feature_columns(include_spend: bool = True, include_regime: bool = True) -> list[str]:
    cols = list(BASE_FEATURE_COLS)
    if include_spend:
        cols.extend(SPEND_FEATURE_COLS)
    if include_regime:
        cols.extend(REGIME_FEATURE_COLS)
    return cols


def _apply_lag_features(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["lag_1"] = out["value"].shift(1)
    out["lag_7"] = out["value"].shift(7)
    out["lag_14"] = out["value"].shift(14)
    out["rolling_mean_7"] = out["value"].shift(1).rolling(7, min_periods=3).mean()
    return out


def _apply_spend_features(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["spend_lag_1"] = out["spend"].shift(1).fillna(0.0)
    out["spend_lag_7"] = out["spend"].shift(7).fillna(0.0)
    out["spend_rolling_7"] = out["spend"].shift(1).rolling(7, min_periods=1).mean().fillna(0.0)
    return out


def _changepoint_recent_series(df: pd.DataFrame, changepoint: dict[str, Any] | None, window: int = 10) -> pd.Series:
    if not changepoint or not changepoint.get("detected") or not changepoint.get("change_date"):
        return pd.Series(0.0, index=df.index)
    cp_date = pd.to_datetime(str(changepoint["change_date"]).split("T")[0])
    dates = pd.to_datetime(df["date"])
    days_since = (dates - cp_date).dt.days
    return ((days_since >= 0) & (days_since <= window)).astype(float)


def _row_features(df: pd.DataFrame, idx: int, feature_cols: list[str]) -> dict[str, float] | None:
    if idx < 1:
        return None
    row: dict[str, float] = {}
    for col in feature_cols:
        if col not in df.columns:
            return None
        val = df[col].iloc[idx]
        if pd.isna(val):
            return None
        row[col] = float(val)
    return row


def build_feature_matrix(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
    feature_cols = feature_columns()
    out = df.copy()
    out = out.dropna(subset=feature_cols + ["value"])
    if out.empty:
        return pd.DataFrame(), pd.Series(dtype=float)
    return out[feature_cols], out["value"]


def build_backtest_train_matrix(df: pd.DataFrame, end_idx: int) -> tuple[pd.DataFrame, pd.Series]:
    feature_cols = feature_columns()
    rows: list[dict[str, float]] = []
    targets: list[float] = []
    for t in range(1, end_idx):
        feat = _row_features(df, t, feature_cols)
        if feat is None:
            continue
        rows.append(feat)
        targets.append(float(df["value"].iloc[t]))
    if not rows:
        return pd.DataFrame(), pd.Series(dtype=float)
    return pd.DataFrame(rows), pd.Series(targets, dtype=float)


def build_backtest_target_features(df: pd.DataFrame, target_idx: int) -> pd.DataFrame | None:
    feature_cols = feature_columns()
    feat = _row_features(df, target_idx, feature_cols)
    if feat is None:
        return None
    return pd.DataFrame([feat])


def _safe_series_lag(series, idx: int, k: int) -> float:
    if idx >= k:
        return float(series[idx - k])
    if idx > 0:
        return float(series[:idx].mean())
    return float(series[0])


def build_adaptive_row_features(
    df: pd.DataFrame,
    idx: int,
    feature_cols: list[str] | None = None,
) -> dict[str, float] | None:
    """Features with fallbacks so ML overlays can start near the beginning of the series."""
    if idx < 1:
        return None
    feature_cols = feature_cols or feature_columns()
    values = df["value"].to_numpy()
    spend = df["spend"].to_numpy()
    cp_val = df["changepoint_recent"].iloc[idx] if "changepoint_recent" in df.columns else 0.0
    if pd.isna(cp_val):
        cp_val = 0.0

    base = {
        "dow": float(df["dow"].iloc[idx]),
        "lag_1": _safe_series_lag(values, idx, 1),
        "lag_7": _safe_series_lag(values, idx, 7),
        "lag_14": _safe_series_lag(values, idx, 14),
        "rolling_mean_7": float(values[max(0, idx - 6) : idx + 1].mean()),
        "spend": float(spend[idx]),
        "spend_lag_1": _safe_series_lag(spend, idx, 1),
        "spend_lag_7": _safe_series_lag(spend, idx, 7),
        "spend_rolling_7": float(spend[max(0, idx - 6) : idx + 1].mean()),
        "changepoint_recent": float(cp_val),
    }
    return {k: base[k] for k in feature_cols if k in base}


def build_adaptive_train_matrix(
    df: pd.DataFrame,
    end_idx: int,
    min_idx: int = 1,
) -> tuple[pd.DataFrame, pd.Series]:
    feature_cols = feature_columns()
    rows: list[dict[str, float]] = []
    targets: list[float] = []
    for t in range(min_idx, end_idx):
        feat = build_adaptive_row_features(df, t, feature_cols)
        if feat is None:
            continue
        rows.append(feat)
        targets.append(float(df["value"].iloc[t]))
    if not rows:
        return pd.DataFrame(), pd.Series(dtype=float)
    return pd.DataFrame(rows), pd.Series(targets, dtype=float)


def build_adaptive_target_features(df: pd.DataFrame, target_idx: int) -> pd.DataFrame | None:
    feature_cols = feature_columns()
    feat = build_adaptive_row_features(df, target_idx, feature_cols)
    if feat is None:
        return None
    return pd.DataFrame([feat])


def build_next_features(df: pd.DataFrame) -> pd.DataFrame | None:
    if len(df) < 15:
        return None
    last_date = pd.to_datetime(df["date"].iloc[-1])
    next_dow = (last_date.dayofweek + 1) % 7
    row = {
        "dow": float(next_dow),
        "lag_1": float(df["value"].iloc[-1]),
        "lag_7": float(df["value"].iloc[-7]),
        "lag_14": float(df["value"].iloc[-14]),
        "rolling_mean_7": float(df["value"].iloc[-7:].mean()),
        "spend": float(df["spend"].iloc[-1]),
        "spend_lag_1": float(df["spend"].iloc[-1]),
        "spend_lag_7": float(df["spend"].iloc[-7]),
        "spend_rolling_7": float(df["spend"].iloc[-7:].mean()),
        "changepoint_recent": float(df["changepoint_recent"].iloc[-1]),
    }
    return pd.DataFrame([row])
