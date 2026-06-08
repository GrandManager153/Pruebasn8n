#!/usr/bin/env python
# -*- coding: utf-8 -*-

import os
import sys
import argparse
import pandas as pd
import numpy as np
from model import PoissonSoccerModel

def print_ev_analysis(market_name, pred_prob, bookie_odds):
    """Calcula y muestra si una apuesta tiene Valor Esperado Positivo (+EV)."""
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
    parser = argparse.ArgumentParser(description="Consola de Predicciones y Analisis de Apuestas de Futbol")
    parser.add_argument("--league", type=str, default="SP1",
                        help="Codigo de la liga a cargar (por defecto SP1 - La Liga de Espana)")
    parser.add_argument("--home", type=str, default=None,
                        help="Nombre del equipo local (ej: 'Real Madrid')")
    parser.add_argument("--away", type=str, default=None,
                        help="Nombre del equipo visitante (ej: 'Barcelona')")
    
    # Cuotas de goles
    parser.add_argument("--odds-1", type=float, default=None, help="Cuota para victoria Local (1)")
    parser.add_argument("--odds-x", type=float, default=None, help="Cuota para el Empate (X)")
    parser.add_argument("--odds-2", type=float, default=None, help="Cuota para victoria Visitante (2)")
    parser.add_argument("--odds-over", type=float, default=None, help="Cuota para Over 2.5 goles")
    parser.add_argument("--odds-under", type=float, default=None, help="Cuota para Under 2.5 goles")
    
    # Cuotas de corners
    parser.add_argument("--corn-line", type=float, default=9.5, help="Linea Over/Under para corners (por defecto 9.5)")
    parser.add_argument("--odds-corn-over", type=float, default=None, help="Cuota para Over corners")
    parser.add_argument("--odds-corn-under", type=float, default=None, help="Cuota para Under corners")
    parser.add_argument("--odds-corn-1", type=float, default=None, help="Cuota para mas corners Local (1)")
    parser.add_argument("--odds-corn-x", type=float, default=None, help="Cuota para empate en corners (X)")
    parser.add_argument("--odds-corn-2", type=float, default=None, help="Cuota para mas corners Visita (2)")
    
    parser.add_argument("--leaderboard", action="store_true", help="Mostrar clasificacion de equipos (Ataque/Defensa)")
    
    args = parser.parse_args()
    
    league = args.league.upper()
    csv_path = os.path.join("data", f"{league}_merged.csv")
    
    if not os.path.exists(csv_path):
        print(f"[Error] No se encontro el dataset en {csv_path}")
        print(f"   Por favor, ejecuta primero: python download_data.py --league {league}")
        sys.exit(1)
        
    # Cargar datos
    df = pd.read_csv(csv_path)
    
    # Entrenar modelo de GOLES
    print("\n--- GOLES: Entrenando modelo ---")
    model_goals = PoissonSoccerModel()
    model_goals.fit(df, 'FTHG', 'FTAG')
    
    # Entrenar modelo de CORNERS (si las columnas existen)
    has_corners = 'HC' in df.columns and 'AC' in df.columns
    model_corners = None
    if has_corners:
        print("\n--- CORNERS: Entrenando modelo ---")
        model_corners = PoissonSoccerModel()
        model_corners.fit(df, 'HC', 'AC')
    else:
        print("\n[Aviso] El dataset no tiene columnas de corners (HC/AC). Solo se calcularan goles.")
        
    # Mostrar clasificación si se solicita
    if args.leaderboard or (args.home is None and args.away is None):
        print("\n[Clasificacion] CLASIFICACION DE FUERZA DE EQUIPOS (Goles):")
        print("   (Un valor de Fuerza de Ataque > 1.0 es mejor que la media)")
        print("   (Un valor de Fuerza de Defensa < 1.0 es mejor que la media)")
        print("="*60)
        leaderboard_df = model_goals.get_leaderboard()
        for idx, row in leaderboard_df.iterrows():
            print(f"{idx+1:02d}. {row['Equipo']:<25} | Ataque: {row['Fuerza_Ataque']:.3f} | Defensa: {row['Fuerza_Defensa']:.3f}")
        print("="*60)
        
        if has_corners:
            print("\n[Clasificacion] CLASIFICACION DE GENERACION DE CORNERS:")
            print("   (Ataque = Capacidad de generar corners, Defensa = Capacidad de conceder pocos corners)")
            print("="*60)
            leaderboard_corn = model_corners.get_leaderboard()
            for idx, row in leaderboard_corn.iterrows():
                print(f"{idx+1:02d}. {row['Equipo']:<25} | Genera: {row['Fuerza_Ataque']:.3f} | Concede: {row['Fuerza_Defensa']:.3f}")
            print("="*60)
            
        if args.home is None or args.away is None:
            print("\n[Tip] Para predecir un partido usa:")
            print(f"   python predict.py --league {league} --home \"Nombre Local\" --away \"Nombre Visita\"")
            sys.exit(0)
            
    # Validar nombres de equipos
    home_name = None
    away_name = None
    
    # Búsqueda insensible a mayúsculas/minúsculas
    for t in model_goals.teams:
        if t.lower() == args.home.lower():
            home_name = t
        if t.lower() == args.away.lower():
            away_name = t
            
    if home_name is None or away_name is None:
        if home_name is None:
            print(f"[Error] No se encontro el equipo local: '{args.home}'")
        if away_name is None:
            print(f"[Error] No se encontro el equipo visitante: '{args.away}'")
            
        print("\n[Equipos] Equipos disponibles en el dataset:")
        print(", ".join(model_goals.teams))
        sys.exit(1)
        
    # ==========================================
    # PREDICCION DE GOLES
    # ==========================================
    pred_goals = model_goals.predict_match(home_name, away_name)
    
    print("\n" + "="*60)
    print(f"[Prediccion] GOLES: {home_name} vs {away_name}")
    print("="*60)
    print(f"   Ritmo de Goles Esperados:")
    print(f"   - {home_name} (Local): {pred_goals['expected_goals_home']:.2f} goles")
    print(f"   - {away_name} (Visita): {pred_goals['expected_goals_away']:.2f} goles")
    print("-"*60)
    
    probs_1x2 = pred_goals['1X2']
    print("   Mercado 1X2 (Resultado Final):")
    print(f"   - Victoria Local (1): {probs_1x2['1']*100:.2f}% (Cuota justa: {1.0/max(probs_1x2['1'], 1e-5):.2f})")
    print(f"   - Empate         (X): {probs_1x2['X']*100:.2f}% (Cuota justa: {1.0/max(probs_1x2['X'], 1e-5):.2f})")
    print(f"   - Victoria Visita(2): {probs_1x2['2']*100:.2f}% (Cuota justa: {1.0/max(probs_1x2['2'], 1e-5):.2f})")
    
    if args.odds_1 or args.odds_x or args.odds_2:
        print("\n   Analisis de Valor (+EV) en 1X2:")
        if args.odds_1:
            print_ev_analysis("Victoria Local (1)", probs_1x2['1'], args.odds_1)
        if args.odds_x:
            print_ev_analysis("Empate (X)", probs_1x2['X'], args.odds_x)
        if args.odds_2:
            print_ev_analysis("Victoria Visita (2)", probs_1x2['2'], args.odds_2)
            
    print("-"*60)
    
    probs_ou = pred_goals['over_under_25']
    probs_btts = pred_goals['btts']
    
    print("   Mercados de Goles:")
    print(f"   - Over  2.5 goles: {probs_ou['over']*100:.2f}% (Cuota justa: {1.0/max(probs_ou['over'], 1e-5):.2f})")
    print(f"   - Under 2.5 goles: {probs_ou['under']*100:.2f}% (Cuota justa: {1.0/max(probs_ou['under'], 1e-5):.2f})")
    print(f"   - Ambos Anotan SI: {probs_btts['yes']*100:.2f}% (Cuota justa: {1.0/max(probs_btts['yes'], 1e-5):.2f})")
    print(f"   - Ambos Anotan NO: {probs_btts['no']*100:.2f}% (Cuota justa: {1.0/max(probs_btts['no'], 1e-5):.2f})")
    
    if args.odds_over or args.odds_under:
        print("\n   Analisis de Valor (+EV) en Goles:")
        if args.odds_over:
            print_ev_analysis("Over 2.5 Goles", probs_ou['over'], args.odds_over)
        if args.odds_under:
            print_ev_analysis("Under 2.5 Goles", probs_ou['under'], args.odds_under)
            
    print("="*60)
    
    # Mostrar marcadores más probables
    matrix = pred_goals['score_matrix']
    flat_indices = np.argsort(matrix.flat)[::-1][:5]
    print("\n   Marcadores mas probables:")
    for idx in flat_indices:
        h, a = np.unravel_index(idx, matrix.shape)
        print(f"   - Marcador {h}-{a}: {matrix[h, a]*100:.2f}% de probabilidad")
    print("="*60)

    # ==========================================
    # PREDICCION DE CORNERS
    # ==========================================
    if has_corners:
        # Usamos max_goals=25 para acomodar el rango más alto de corners
        pred_corners = model_corners.predict_match(home_name, away_name, max_goals=25)
        
        # Calcular Over/Under personalizado para la línea solicitada
        score_matrix_c = pred_corners['score_matrix']
        prob_corn_over = 0.0
        for h in range(score_matrix_c.shape[0]):
            for a in range(score_matrix_c.shape[1]):
                if h + a > args.corn_line:
                    prob_corn_over += score_matrix_c[h, a]
        prob_corn_under = 1.0 - prob_corn_over
        
        print("\n" + "="*60)
        print(f"[Prediccion] TIROS DE ESQUINA (CORNERS): {home_name} vs {away_name}")
        print("="*60)
        print(f"   Ritmo de Corners Esperados:")
        print(f"   - {home_name} (Local): {pred_corners['expected_goals_home']:.2f} corners")
        print(f"   - {away_name} (Visita): {pred_corners['expected_goals_away']:.2f} corners")
        print(f"   - Total esperados: {pred_corners['expected_goals_home'] + pred_corners['expected_goals_away']:.2f} corners")
        print("-"*60)
        
        probs_corn_1x2 = pred_corners['1X2']
        print("   Mercado 1X2 Corners (Mas corners sacados):")
        print(f"   - Mas Local (1): {probs_corn_1x2['1']*100:.2f}% (Cuota justa: {1.0/max(probs_corn_1x2['1'], 1e-5):.2f})")
        print(f"   - Empate     (X): {probs_corn_1x2['X']*100:.2f}% (Cuota justa: {1.0/max(probs_corn_1x2['X'], 1e-5):.2f})")
        print(f"   - Mas Visita (2): {probs_corn_1x2['2']*100:.2f}% (Cuota justa: {1.0/max(probs_corn_1x2['2'], 1e-5):.2f})")
        
        if args.odds_corn_1 or args.odds_corn_x or args.odds_corn_2:
            print("\n   Analisis de Valor (+EV) en 1X2 Corners:")
            if args.odds_corn_1:
                print_ev_analysis("Mas Local (1)", probs_corn_1x2['1'], args.odds_corn_1)
            if args.odds_corn_x:
                print_ev_analysis("Empate (X)", probs_corn_1x2['X'], args.odds_corn_x)
            if args.odds_corn_2:
                print_ev_analysis("Mas Visita (2)", probs_corn_1x2['2'], args.odds_corn_2)
                
        print("-"*60)
        
        print(f"   Mercado Over/Under {args.corn_line} Corners:")
        print(f"   - Over  {args.corn_line}: {prob_corn_over*100:.2f}% (Cuota justa: {1.0/max(prob_corn_over, 1e-5):.2f})")
        print(f"   - Under {args.corn_line}: {prob_corn_under*100:.2f}% (Cuota justa: {1.0/max(prob_corn_under, 1e-5):.2f})")
        
        if args.odds_corn_over or args.odds_corn_under:
            print("\n   Analisis de Valor (+EV) en Over/Under Corners:")
            if args.odds_corn_over:
                print_ev_analysis(f"Over {args.corn_line} Corners", prob_corn_over, args.odds_corn_over)
            if args.odds_corn_under:
                print_ev_analysis(f"Under {args.corn_line} Corners", prob_corn_under, args.odds_corn_under)
        print("="*60)

if __name__ == "__main__":
    main()
