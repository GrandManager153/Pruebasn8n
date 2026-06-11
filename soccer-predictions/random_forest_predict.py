#!/usr/bin/env python
# -*- coding: utf-8 -*-

import os
import sys
import argparse
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score

def generate_synthetic_international_data(n_matches=2500, random_seed=42):
    """
    Genera un dataset sintetico realista de partidos internacionales
    para poder entrenar el clasificador de Random Forest.
    """
    np.random.seed(random_seed)
    
    # 1. Generar variables base
    # Elo de los equipos (rango realista de 1400 a 2100)
    home_elos = np.random.normal(1700, 120, n_matches).astype(int)
    away_elos = np.random.normal(1700, 120, n_matches).astype(int)
    
    # Asegurar que se queden en limites realistas
    home_elos = np.clip(home_elos, 1300, 2200)
    away_elos = np.clip(away_elos, 1300, 2200)
    
    # Diferencia de elo
    elo_diffs = home_elos - away_elos
    
    # Estadio neutral (1 = neutral, 0 = localia)
    is_neutral = np.random.choice([0, 1], size=n_matches, p=[0.75, 0.25])
    
    # Forma reciente (goles promedio ultimos partidos, correlacionado debilmente con ELO)
    home_forms = np.clip(np.random.normal(1.5, 0.5, n_matches) + (home_elos - 1700) * 0.001, 0.5, 4.0)
    away_forms = np.clip(np.random.normal(1.5, 0.5, n_matches) + (away_elos - 1700) * 0.001, 0.5, 4.0)
    
    # 2. Definir probabilidades verdaderas usando una funcion logistica (softmax)
    # Se introduce ventaja de localia (+100 ELO si no es neutral)
    home_advantage = 90.0
    effective_elo_diff = elo_diffs + (home_advantage * (1 - is_neutral))
    
    # Formula para el Score de superioridad
    # Combina diferencia de elo y diferencia de goles en forma reciente
    superiority_score = 0.0045 * effective_elo_diff + 0.3 * (home_forms - away_forms)
    
    # Softmax para obtener 3 probabilidades (Local, Empate, Visita)
    # Ajustamos la constante de empate para que represente aprox 23%-26% de los partidos
    exp_home = np.exp(superiority_score)
    exp_away = np.exp(-superiority_score)
    exp_draw = np.ones(n_matches) * 0.75 # constante de empate
    
    sum_exp = exp_home + exp_away + exp_draw
    prob_home = exp_home / sum_exp
    prob_away = exp_away / sum_exp
    prob_draw = exp_draw / sum_exp
    
    # 3. Muestrear los resultados del partido en base a las probabilidades
    # 1: Victoria Local, X: Empate (usamos 0), 2: Victoria Visita (usamos 2)
    outcomes = []
    for i in range(n_matches):
        p = [prob_draw[i], prob_home[i], prob_away[i]]
        # Normalizar para seguridad
        p /= np.sum(p)
        outcomes.append(np.random.choice([0, 1, 2], p=p))
        
    # Crear DataFrame
    df = pd.DataFrame({
        'home_elo': home_elos,
        'away_elo': away_elos,
        'elo_diff': elo_diffs,
        'is_neutral': is_neutral,
        'home_form': home_forms,
        'away_form': away_forms,
        'outcome': outcomes
    })
    
    return df

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
    parser = argparse.ArgumentParser(description="Modelo Random Forest para Prediccion de Partidos Internacionales")
    parser.add_argument("--home", type=str, default="Mexico", help="Nombre del equipo local")
    parser.add_argument("--away", type=str, default="Serbia", help="Nombre del equipo visitante")
    parser.add_argument("--home-elo", type=int, default=1858, help="Elo del equipo local (por defecto 1858 para Mexico)")
    parser.add_argument("--away-elo", type=int, default=1769, help="Elo del equipo visitante (por defecto 1769 para Serbia)")
    parser.add_argument("--home-form", type=float, default=1.8, help="Goles promedio anotados por el local recientemente")
    parser.add_argument("--away-form", type=float, default=1.4, help="Goles promedio anotados por el visitante recientemente")
    parser.add_argument("--is-neutral", type=int, default=1, choices=[0, 1], 
                        help="Estadio neutral (1) o localia del equipo 1 (0). Por defecto 1 (Mexico vs Serbia suele ser neutral, ej. en EEUU)")
    
    # Cuotas
    parser.add_argument("--odds-1", type=float, default=None, help="Cuota para victoria Local (1)")
    parser.add_argument("--odds-x", type=float, default=None, help="Cuota para el Empate (X)")
    parser.add_argument("--odds-2", type=float, default=None, help="Cuota para victoria Visitante (2)")
    
    args = parser.parse_args()
    
    print("[Datos] Generando historial sintetico de 2,500 partidos internacionales...")
    data = generate_synthetic_international_data(n_matches=2500)
    
    # Separar variables predictoras (X) y variable objetivo (y)
    # Usaremos las variables de diferencia de elo, estadio neutral y forma
    X = data[['elo_diff', 'is_neutral', 'home_form', 'away_form']]
    y = data['outcome']
    
    # Separar en entrenamiento y validacion
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    # Entrenar clasificador de Random Forest
    print("[Modelo] Entrenando Clasificador Random Forest (n_estimators=200)...")
    clf = RandomForestClassifier(n_estimators=200, max_depth=6, random_state=42)
    clf.fit(X_train, y_train)
    
    # Evaluar precision
    train_acc = accuracy_score(y_train, clf.predict(X_train))
    test_acc = accuracy_score(y_test, clf.predict(X_test))
    print(f"   - Precision en Entrenamiento (Accuracy): {train_acc*100:.2f}%")
    print(f"   - Precision en Validacion (Accuracy): {test_acc*100:.2f}%")
    print("   (Nota: En futbol, un accuracy de 50%-55% es normal y excelente debido al alto azar)")
    
    # ==========================================
    # PREDICCION DE PARTIDO SOLICITADO
    # ==========================================
    elo_diff = args.home_elo - args.away_elo
    
    # Crear vector de caracteristicas para el partido solicitado
    match_features = pd.DataFrame([{
        'elo_diff': elo_diff,
        'is_neutral': args.is_neutral,
        'home_form': args.home_form,
        'away_form': args.away_form
    }])
    
    # Obtener probabilidades
    # predict_proba devuelve una lista en orden de clases: [0, 1, 2] -> [Empate, Local, Visita]
    probs = clf.predict_proba(match_features)[0]
    
    prob_draw = probs[0]
    prob_home = probs[1]
    prob_away = probs[2]
    
    # Mostrar resultados
    print("\n" + "="*60)
    print(f"[Prediccion] PREDICCION RANDOM FOREST: {args.home} vs {args.away}")
    print("="*60)
    print(f"   Datos de Entrada:")
    print(f"   - Elo {args.home}: {args.home_elo} | Forma reciente: {args.home_form:.2f} goles/partido")
    print(f"   - Elo {args.away}: {args.away_elo} | Forma reciente: {args.away_form:.2f} goles/partido")
    print(f"   - Diferencia de Elo: {elo_diff} (Ventaja Local: {'No' if args.is_neutral == 1 else 'Si (Equipo 1)'})")
    print("-"*60)
    print("   Mercado 1X2 (Resultado Final):")
    print(f"   - Victoria {args.home} (1): {prob_home*100:.2f}% (Cuota justa: {1.0/max(prob_home, 1e-5):.2f})")
    print(f"   - Empate           (X): {prob_draw*100:.2f}% (Cuota justa: {1.0/max(prob_draw, 1e-5):.2f})")
    print(f"   - Victoria {args.away} (2): {prob_away*100:.2f}% (Cuota justa: {1.0/max(prob_away, 1e-5):.2f})")
    print("-"*60)
    
    # Analisis de valor si se proveen cuotas
    if args.odds_1 or args.odds_x or args.odds_2:
        print("   Analisis de Valor (+EV) en 1X2:")
        if args.odds_1:
            print_ev_analysis(f"Victoria {args.home} (1)", prob_home, args.odds_1)
        if args.odds_x:
            print_ev_analysis("Empate (X)", prob_draw, args.odds_x)
        if args.odds_2:
            print_ev_analysis(f"Victoria {args.away} (2)", prob_away, args.odds_2)
        print("="*60)
        
if __name__ == "__main__":
    main()
