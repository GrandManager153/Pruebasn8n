"""Feature engineering for daily lead volume forecasting."""

from __future__ import annotations

import pandas as pd


def series_to_dataframe(series: list[dict]) -> pd.DataFrame:
    rows = []
    for p in series:
        d = p.get("date") or p.get("fecha")
        v = p.get("value")
        if v is None:
            v = p.get("contactos")
        if d is None or v is None:
            continue
        rows.append({"date": str(d).split("T")[0], "value": float(v)})
    if not rows:
        return pd.DataFrame(columns=["date", "value"])
    df = pd.DataFrame(rows).drop_duplicates(subset=["date"]).sort_values("date")
    df["value"] = df["value"].astype(float)
    df["dow"] = pd.to_datetime(df["date"]).dt.dayofweek
    return df.reset_index(drop=True)


def build_feature_matrix(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
    """Build supervised rows; drop rows with NaN from lags."""
    out = df.copy()
    out["lag_1"] = out["value"].shift(1)
    out["lag_7"] = out["value"].shift(7)
    out["lag_14"] = out["value"].shift(14)
    out["rolling_mean_7"] = out["value"].shift(1).rolling(7, min_periods=3).mean()
    feature_cols = ["dow", "lag_1", "lag_7", "lag_14", "rolling_mean_7"]
    out = out.dropna(subset=feature_cols + ["value"])
    if out.empty:
        return pd.DataFrame(), pd.Series(dtype=float)
    return out[feature_cols], out["value"]


def build_backtest_train_matrix(df: pd.DataFrame, end_idx: int) -> tuple[pd.DataFrame, pd.Series]:
    """Rolling training rows using only lags available before end_idx (from day 1)."""
    rows: list[dict[str, float]] = []
    targets: list[float] = []
    for t in range(1, end_idx):
        lag7 = float(df["value"].iloc[t - 7]) if t >= 7 else float(df["value"].iloc[0])
        rows.append(
            {
                "dow": float(df["dow"].iloc[t]),
                "lag_1": float(df["value"].iloc[t - 1]),
                "lag_7": lag7,
                "rolling_mean_7": float(df["value"].iloc[max(0, t - 7) : t].mean()),
            }
        )
        targets.append(float(df["value"].iloc[t]))
    if not rows:
        return pd.DataFrame(), pd.Series(dtype=float)
    return pd.DataFrame(rows), pd.Series(targets, dtype=float)


def build_backtest_target_features(df: pd.DataFrame, target_idx: int) -> pd.DataFrame | None:
    """Features for one-step prediction at target_idx using history before it."""
    if target_idx < 1:
        return None
    lag7 = float(df["value"].iloc[target_idx - 7]) if target_idx >= 7 else float(df["value"].iloc[0])
    row = {
        "dow": float(df["dow"].iloc[target_idx]),
        "lag_1": float(df["value"].iloc[target_idx - 1]),
        "lag_7": lag7,
        "rolling_mean_7": float(df["value"].iloc[max(0, target_idx - 7) : target_idx].mean()),
    }
    return pd.DataFrame([row])


def build_next_features(df: pd.DataFrame) -> pd.DataFrame | None:
    """Features for forecasting the day after the last observation."""
    if len(df) < 15:
        return None
    last_date = pd.to_datetime(df["date"].iloc[-1])
    next_dow = (last_date.dayofweek + 1) % 7
    row = {
        "dow": next_dow,
        "lag_1": df["value"].iloc[-1],
        "lag_7": df["value"].iloc[-7],
        "lag_14": df["value"].iloc[-14],
        "rolling_mean_7": df["value"].iloc[-7:].mean(),
    }
    return pd.DataFrame([row])
