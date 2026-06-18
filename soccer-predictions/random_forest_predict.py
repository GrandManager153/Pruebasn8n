#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
random_forest_predict.py (v2.1 - Datos Reales)
-----------------------------------------------
Random Forest calibrado para prediccion del Mundial 2026.
Mejoras vs v2.0:
  - Usa datos historicos REALES (via data_loader.py) en lugar de sinteticos
  - 12 variables reales (mismas que MLP y GB)
  - CalibratedClassifierCV para calibracion de probabilidades
  - Persistencia de modelo entrenado en .pkl
"""

import os
import sys
import argparse
import pickle
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.calibration import CalibratedClassifierCV
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, brier_score_loss

# Importar cargador de datos reales
try:
    from data_loader import load_and_preprocess_real_data
    DATA_LOADER_AVAILABLE = True
except ImportError:
    DATA_LOADER_AVAILABLE = False

# Features compartidas con MLP y GB
FEATURE_COLS = [
    'elo_diff', 'is_neutral', 'home_form_scored', 'away_form_scored',
    'home_form_conceded', 'away_form_conceded', 'altitude_impact',
    'temperature', 'h2h_win_rate', 'market_ratio', 'rest_diff', 'stage'
]

FEATURE_LABELS = FEATURE_COLS  # Alias para compatibilidad con neural_network_predict.py

MODEL_PATH = os.path.join("data", "random_forest_model.pkl")


def brier_multiclass(y_true, y_proba, classes):
    """Brier Score promedio para clasificacion multiclase (menor = mejor)."""
    total = 0.0
    for i, cls in enumerate(classes):
        y_bin = (y_true == cls).astype(int)
        total += brier_score_loss(y_bin, y_proba[:, i])
    return total / len(classes)


def generate_enhanced_data(n_matches=5000):
    """
    Genera datos de entrenamiento. Prioriza datos reales;
    si no estan disponibles, usa generacion sintetica como fallback.
    """
    if DATA_LOADER_AVAILABLE:
        try:
            data = load_and_preprocess_real_data(start_year=2000)
            if len(data) > 1000:
                return data
        except Exception as e:
            print(f"   [Aviso] Error cargando datos reales: {e}. Usando fallback sintetico.")

    # Fallback sintetico (solo si no hay datos reales)
    return _generate_synthetic_data(n_matches)


def _generate_synthetic_data(n_matches=5000):
    """Generador sintetico de respaldo con 12 features."""
    np.random.seed(42)
    
    home_elos = np.clip(np.random.normal(1700, 120, n_matches).astype(int), 1300, 2200)
    away_elos = np.clip(np.random.normal(1700, 120, n_matches).astype(int), 1300, 2200)
    elo_diffs = home_elos - away_elos
    is_neutral = np.random.choice([0, 1], size=n_matches, p=[0.75, 0.25])
    
    home_forms = np.clip(np.random.normal(1.5, 0.5, n_matches) + (home_elos - 1700) * 0.001, 0.5, 4.0)
    away_forms = np.clip(np.random.normal(1.5, 0.5, n_matches) + (away_elos - 1700) * 0.001, 0.5, 4.0)
    home_def = np.clip(np.random.normal(1.2, 0.4, n_matches), 0.3, 3.0)
    away_def = np.clip(np.random.normal(1.2, 0.4, n_matches), 0.3, 3.0)
    
    altitude_impact = np.random.normal(0, 0.2, n_matches)
    temperature = np.clip(np.random.normal(22, 5, n_matches), 10, 38)
    h2h_win_rate = np.clip(np.random.normal(0.4, 0.15, n_matches), 0.0, 1.0)
    market_ratio = np.clip(np.random.lognormal(0, 0.5, n_matches), 0.1, 10.0)
    rest_diff = np.clip(np.random.normal(0, 2, n_matches).astype(int), -7, 7)
    stage = np.random.choice([0, 1, 2, 3], size=n_matches, p=[0.3, 0.3, 0.25, 0.15])
    
    # Probabilidades basadas en features
    home_advantage = 90.0
    effective_elo_diff = elo_diffs + (home_advantage * (1 - is_neutral))
    superiority_score = 0.0045 * effective_elo_diff + 0.3 * (home_forms - away_forms)
    
    exp_home = np.exp(superiority_score)
    exp_away = np.exp(-superiority_score)
    exp_draw = np.ones(n_matches) * 0.75
    
    sum_exp = exp_home + exp_away + exp_draw
    prob_home = exp_home / sum_exp
    prob_away = exp_away / sum_exp
    prob_draw = exp_draw / sum_exp
    
    outcomes = []
    for i in range(n_matches):
        p = [prob_draw[i], prob_home[i], prob_away[i]]
        p /= np.sum(p)
        outcomes.append(np.random.choice([0, 1, 2], p=p))
    
    df = pd.DataFrame({
        'elo_diff': elo_diffs,
        'is_neutral': is_neutral,
        'home_form_scored': home_forms,
        'away_form_scored': away_forms,
        'home_form_conceded': home_def,
        'away_form_conceded': away_def,
        'altitude_impact': altitude_impact,
        'temperature': temperature,
        'h2h_win_rate': h2h_win_rate,
        'market_ratio': market_ratio,
        'rest_diff': rest_diff,
        'stage': stage,
        'sample_weight': np.ones(n_matches),
        'outcome': outcomes
    })
    return df


def train_rf_model(force_train=False, start_year=2000):
    """Entrena o carga el modelo Random Forest calibrado."""
    if not force_train and os.path.exists(MODEL_PATH):
        try:
            print(f"\n[Modelo RF] Cargando modelo pre-entrenado desde {MODEL_PATH}...")
            with open(MODEL_PATH, "rb") as f:
                saved = pickle.load(f)
            # Verificar que el modelo guardado tiene las features correctas
            if saved.get("feature_cols") == FEATURE_COLS:
                model = saved["model"]
                print(f"   [OK] Modelo RF cargado. Accuracy test: {saved['test_acc']*100:.2f}% | Brier: {saved.get('brier', 0):.4f}")
                return model, saved["test_acc"], saved.get("brier", 0)
            else:
                print("   [Info] El modelo guardado usa features diferentes. Re-entrenando...")
        except Exception as e:
            print(f"   [Aviso] Error al cargar modelo: {e}. Re-entrenando...")

    print("\n[Modelo RF] Preparando datos para entrenamiento...")
    data = generate_enhanced_data()

    X = data[FEATURE_COLS]
    y = data['outcome']
    w = data.get('sample_weight', pd.Series(1.0, index=data.index))

    X_train, X_test, y_train, y_test, w_train, w_test = train_test_split(
        X, y, w, test_size=0.2, random_state=42, stratify=y
    )

    # Remuestreo ponderado
    resampled_idx = X_train.sample(n=len(X_train), replace=True, weights=w_train, random_state=42).index
    X_train = X_train.loc[resampled_idx]
    y_train = y_train.loc[resampled_idx]

    print(f"[Modelo RF] Entrenando Random Forest Calibrado...")
    print(f"   n_estimators=300 | max_depth=8 | class_weight=balanced")
    print(f"   Train: {len(X_train)} | Test: {len(X_test)}")

    base_rf = RandomForestClassifier(
        n_estimators=300, max_depth=8,
        class_weight='balanced', n_jobs=-1, random_state=42
    )
    model = CalibratedClassifierCV(base_rf, method='isotonic', cv=3)
    model.fit(X_train, y_train)

    # Evaluar
    train_acc = accuracy_score(y_train, model.predict(X_train))
    test_acc = accuracy_score(y_test, model.predict(X_test))
    test_proba = model.predict_proba(X_test)
    brier = brier_multiclass(y_test.values, test_proba, model.classes_)

    print(f"\n   Precision entrenamiento : {train_acc*100:.2f}%")
    print(f"   Precision validacion    : {test_acc*100:.2f}%")
    print(f"   Brier Score             : {brier:.4f} (menor = mejor)")

    # Guardar modelo
    os.makedirs("data", exist_ok=True)
    with open(MODEL_PATH, "wb") as f:
        pickle.dump({
            "model": model,
            "train_acc": train_acc,
            "test_acc": test_acc,
            "brier": brier,
            "feature_cols": FEATURE_COLS
        }, f)
    print(f"   [OK] Modelo RF guardado en {MODEL_PATH}")

    return model, test_acc, brier


def print_ev_analysis(market_name, pred_prob, bookie_odds):
    implied_prob = 1.0 / bookie_odds
    ev = (pred_prob * bookie_odds) - 1.0
    ev_pct = ev * 100
    print(f"   - {market_name}:")
    print(f"     Probabilidad Modelo: {pred_prob*100:.2f}%")
    print(f"     Cuota Casa: {bookie_odds} (Probabilidad Implicita: {implied_prob*100:.2f}%)")
    if ev > 0:
        print(f"     [VALOR DETECTADO (+EV)]: +{ev_pct:.2f}% de Retorno Esperado")
    else:
        print(f"     [Sin valor (-EV)]: {ev_pct:.2f}% de Retorno Esperado")


def main():
    parser = argparse.ArgumentParser(description="Random Forest v2.1 - Prediccion Mundial 2026")
    parser.add_argument("--force-train", action="store_true",
                        help="Fuerza el re-entrenamiento del modelo")
    parser.add_argument("--home", type=str, default=None)
    parser.add_argument("--away", type=str, default=None)
    args = parser.parse_args()

    print("=" * 65)
    print("  RANDOM FOREST v2.1 - PREDICCION MUNDIAL 2026")
    print("=" * 65)

    model, test_acc, brier = train_rf_model(force_train=args.force_train)

    print("=" * 65)


if __name__ == "__main__":
    main()
