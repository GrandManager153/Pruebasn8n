"""ML Forecast API for n8n Cloud integration."""

from __future__ import annotations

import os
from typing import Any

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from model import run_forecast

API_KEY = os.environ.get("API_KEY", "dev-key-change-me")

app = FastAPI(title="ML Forecast API", version="1.0.0")


class SeriesPoint(BaseModel):
    date: str | None = None
    fecha: str | None = None
    value: float | None = None
    contactos: int | float | None = None


class PredictRequest(BaseModel):
    series: list[SeriesPoint]
    backtest_days: int = Field(default=14, ge=1, le=30)
    model: str = "random_forest"


def _check_api_key(x_api_key: str | None) -> None:
    if not x_api_key or x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing X-API-Key")


@app.get("/health")
def health() -> dict[str, bool]:
    return {"ok": True}


@app.post("/predict")
def predict(
    body: PredictRequest,
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
) -> dict[str, Any]:
    _check_api_key(x_api_key)
    raw = [p.model_dump() for p in body.series]
    result = run_forecast(raw, backtest_days=body.backtest_days)
    if result.get("error"):
        raise HTTPException(status_code=400, detail=result)
    return result
