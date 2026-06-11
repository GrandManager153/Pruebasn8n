#!/usr/bin/env python
# -*- coding: utf-8 -*-

import os
import sys
import numpy as np
import pandas as pd
from scipy.stats import poisson

def get_poisson_probability_over_under(lambda_home, lambda_away, line, max_val=25):
    """Calcula la probabilidad de Over y Under para una linea especifica usando Poisson."""
    h_probs = poisson.pmf(np.arange(max_val + 1), lambda_home)
    a_probs = poisson.pmf(np.arange(max_val + 1), lambda_away)
    
    h_probs /= np.sum(h_probs)
    a_probs /= np.sum(a_probs)
    
    score_matrix = np.outer(h_probs, a_probs)
    
    prob_over = 0.0
    for h in range(max_val + 1):
        for a in range(max_val + 1):
            if h + a > line:
                prob_over += score_matrix[h, a]
                
    return prob_over, 1.0 - prob_over

def main():
    mexico_path = os.path.join("data", "mexico_stats.csv")
    serbia_path = os.path.join("data", "serbia_stats.csv")
    
    if not os.path.exists(mexico_path) or not os.path.exists(serbia_path):
        print("[Error] No se encontraron las estadisticas avanzadas.")
        print("        Por favor, ejecuta: python download_international_data.py")
        sys.exit(1)
        
    mex = pd.read_csv(mexico_path)
    ser = pd.read_csv(serbia_path)
    
    # 1. Promedios basicos
    mex_corn_fav = mex['corners_favor'].mean()
    mex_corn_con = mex['corners_contra'].mean()
    mex_cards = mex['amarillas_favor'].mean()
    mex_shots = mex['tiros_arco'].mean()
    mex_fouls = mex['faltas'].mean()
    
    ser_corn_fav = ser['corners_favor'].mean()
    ser_corn_con = ser['corners_contra'].mean()
    ser_cards = ser['amarillas_favor'].mean()
    ser_shots = ser['tiros_arco'].mean()
    ser_fouls = ser['faltas'].mean()
    
    # Promedios globales estandares de selecciones
    global_corn_avg = 4.6
    global_cards_avg = 2.0
    global_shots_avg = 4.2
    
    # 2. Modelado de Poisson para CORNERS
    # Mexico atacando corners vs Serbia defendiendo corners
    lambda_mex_corn = (mex_corn_fav / global_corn_avg) * (ser_corn_con / global_corn_avg) * global_corn_avg
    # Serbia atacando corners vs Mexico defendiendo corners
    lambda_ser_corn = (ser_corn_fav / global_corn_avg) * (mex_corn_con / global_corn_avg) * global_corn_avg
    
    # 3. Modelado de Poisson para TARJETAS AMARILLAS
    # Las tarjetas son una interaccion de agresividad (se modelan directamente con sus promedios locales/visita)
    # y son altamente influenciadas por el arbitro (asumimos un arbitro promedio)
    lambda_mex_cards = mex_cards
    lambda_ser_cards = ser_cards
    
    # 4. Modelado de Poisson para TIROS AL ARCO
    lambda_mex_shots = (mex_shots / global_shots_avg) * global_shots_avg
    lambda_ser_shots = (ser_shots / global_shots_avg) * global_shots_avg
    
    print("="*60)
    print("[Predicciones] PREDICCIONES AVANZADAS DE POISSON: Mexico vs Serbia")
    print("============================================================")
    print("   TIROS DE ESQUINA (CORNERS):")
    print(f"   - Corners esperados Mexico: {lambda_mex_corn:.2f}")
    print(f"   - Corners esperados Serbia: {lambda_ser_corn:.2f}")
    print(f"   - Total esperados: {lambda_mex_corn + lambda_ser_corn:.2f}")
    
    # Calculo Over/Under 9.5 corners
    corn_line = 9.5
    prob_corn_over, prob_corn_under = get_poisson_probability_over_under(lambda_mex_corn, lambda_ser_corn, corn_line)
    print(f"   - Probabilidad Over {corn_line}: {prob_corn_over*100:.2f}% (Cuota justa: {1.0/prob_corn_over:.2f})")
    print(f"   - Probabilidad Under {corn_line}: {prob_corn_under*100:.2f}% (Cuota justa: {1.0/prob_corn_under:.2f})")
    
    print("-"*60)
    print("   TARJETAS AMARILLAS:")
    print(f"   - Tarjetas esperadas Mexico: {lambda_mex_cards:.2f}")
    print(f"   - Tarjetas esperadas Serbia: {lambda_ser_cards:.2f}")
    print(f"   - Total esperadas: {lambda_mex_cards + lambda_ser_cards:.2f}")
    
    # Calculo Over/Under 3.5 tarjetas
    card_line = 3.5
    prob_card_over, prob_card_under = get_poisson_probability_over_under(lambda_mex_cards, lambda_ser_cards, card_line)
    print(f"   - Probabilidad Over {card_line}: {prob_card_over*100:.2f}% (Cuota justa: {1.0/prob_card_over:.2f})")
    print(f"   - Probabilidad Under {card_line}: {prob_card_under*100:.2f}% (Cuota justa: {1.0/prob_card_under:.2f})")
    
    print("-"*60)
    print("   TIROS AL ARCO:")
    print(f"   - Tiros al arco esperados Mexico: {lambda_mex_shots:.2f}")
    print(f"   - Tiros al arco esperados Serbia: {lambda_ser_shots:.2f}")
    print(f"   - Total esperados: {lambda_mex_shots + lambda_ser_shots:.2f}")
    
    # Calculo Over/Under 8.5 tiros al arco
    shots_line = 8.5
    prob_shots_over, prob_shots_under = get_poisson_probability_over_under(lambda_mex_shots, lambda_ser_shots, shots_line)
    print(f"   - Probabilidad Over {shots_line}: {prob_shots_over*100:.2f}% (Cuota justa: {1.0/prob_shots_over:.2f})")
    print(f"   - Probabilidad Under {shots_line}: {prob_shots_under*100:.2f}% (Cuota justa: {1.0/prob_shots_under:.2f})")
    
    print("="*60)

if __name__ == "__main__":
    main()
