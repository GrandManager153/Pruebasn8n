# -*- coding: utf-8 -*-

import numpy as np
import pandas as pd
from scipy.optimize import minimize
from scipy.stats import poisson

class PoissonSoccerModel:
    """
    Modelo de Regresión Poisson para predicción de resultados de fútbol.
    Estima la habilidad de ataque y defensa de cada equipo, junto con la ventaja de localía.
    """
    def __init__(self):
        self.teams = []
        self.team_to_idx = {}
        self.idx_to_team = {}
        self.num_teams = 0
        self.params = None
        self.attack_params = None
        self.defense_params = None
        self.home_advantage = 1.0
        self.fitted = False

    def fit(self, df, home_col='FTHG', away_col='FTAG'):
        """
        Entrena el modelo usando un DataFrame que contenga:
        'HomeTeam', 'AwayTeam' y las columnas de valor indicadas (goles o corners).
        """
        # Extraer lista única de equipos
        self.teams = sorted(list(set(df['HomeTeam'].unique()) | set(df['AwayTeam'].unique())))
        self.num_teams = len(self.teams)
        self.team_to_idx = {team: idx for idx, team in enumerate(self.teams)}
        self.idx_to_team = {idx: team for idx, team in enumerate(self.teams)}
        
        # Preparar los partidos para optimización rápida
        matches = []
        for _, row in df.iterrows():
            matches.append({
                'home_idx': self.team_to_idx[row['HomeTeam']],
                'away_idx': self.team_to_idx[row['AwayTeam']],
                'home_val': float(row[home_col]),
                'away_val': float(row[away_col])
            })
            
        # Parámetros iniciales:
        # - attack (1.0 para cada equipo)
        # - defense (1.0 para cada equipo)
        # - home_advantage (1.2 inicial)
        init_params = np.concatenate([
            np.ones(self.num_teams),      # attacks
            np.ones(self.num_teams),      # defenses
            [1.2]                         # home advantage
        ])
        
        # Límites para evitar valores absurdos o negativos
        bounds = (
            [(0.1, 10.0)] * self.num_teams +     # bounds para ataques
            [(0.1, 10.0)] * self.num_teams +     # bounds para defensas
            [(0.5, 3.0)]                         # bounds para ventaja local
        )
        
        # Función de pérdida: Log-verosimilitud negativa con penalización
        # para forzar que el promedio de ataque sea cercano a 1.0
        def negative_log_likelihood(params):
            att = params[:self.num_teams]
            dfn = params[self.num_teams:2*self.num_teams]
            home_adv = params[2*self.num_teams]
            
            # Penalización para dar estabilidad a la optimización
            # (hace que los parámetros sean interpretables alrededor de 1.0)
            penalty = 10000.0 * (np.mean(att) - 1.0)**2
            
            nll = 0.0
            for m in matches:
                h_idx = m['home_idx']
                a_idx = m['away_idx']
                h_val = m['home_val']
                a_val = m['away_val']
                
                # Ritmo de goles/corners esperados
                lambda_h = att[h_idx] * dfn[a_idx] * home_adv
                mu_a = att[a_idx] * dfn[h_idx]
                
                # Log-verosimilitud de Poisson (se ignora el término log(y!) que es constante)
                nll += lambda_h - h_val * np.log(max(lambda_h, 1e-10))
                nll += mu_a - a_val * np.log(max(mu_a, 1e-10))
                
            return nll + penalty

        print("Optimizando parametros del modelo Poisson...")
        res = minimize(
            negative_log_likelihood, 
            init_params, 
            method='L-BFGS-B', 
            bounds=bounds
        )
        
        if not res.success:
            print("Advertencia: La optimizacion no convergio del todo:", res.message)
            
        self.params = res.x
        self.attack_params = self.params[:self.num_teams]
        self.defense_params = self.params[self.num_teams:2*self.num_teams]
        self.home_advantage = self.params[2*self.num_teams]
        self.fitted = True
        
        print("Modelo ajustado correctamente.")
        print(f"   - Equipos: {self.num_teams}")
        print(f"   - Ventaja de Localia Estimada: {self.home_advantage:.3f} (goles/corners multiplicador)")
        
    def get_team_params(self, team_name):
        """Devuelve los parámetros de ataque y defensa de un equipo específico."""
        if not self.fitted:
            raise ValueError("El modelo debe ser entrenado antes de consultar parámetros.")
        if team_name not in self.team_to_idx:
            return None
        idx = self.team_to_idx[team_name]
        return {
            'attack': self.attack_params[idx],
            'defense': self.defense_params[idx]
        }

    def get_leaderboard(self):
        """Devuelve un DataFrame ordenado con la fuerza de ataque y defensa de los equipos."""
        if not self.fitted:
            raise ValueError("El modelo debe ser entrenado.")
        
        df = pd.DataFrame({
            'Equipo': self.teams,
            'Fuerza_Ataque': self.attack_params,
            # Invertimos defensa para que un valor menor (menos goles recibidos) sea mejor
            # o lo dejamos crudo y explicamos que menor es mejor defensa.
            # Mostramos crudo (menor es mejor defensa) y una columna calculada de calidad
            'Fuerza_Defensa': self.defense_params
        })
        
        # Una fuerza de defensa menor a 1.0 significa que defiende mejor que el promedio.
        # Ordenamos por fuerza de ataque descendente.
        return df.sort_values(by='Fuerza_Ataque', ascending=False).reset_index(drop=True)

    def predict_match(self, home_team, away_team, max_goals=10):
        """
        Predice las probabilidades del partido entre Home y Away.
        Devuelve un diccionario con las probabilidades de los mercados clave.
        """
        if not self.fitted:
            raise ValueError("El modelo debe estar entrenado.")
            
        if home_team not in self.team_to_idx or away_team not in self.team_to_idx:
            raise ValueError(f"Uno de los equipos no está en el dataset: '{home_team}' o '{away_team}'")
            
        h_idx = self.team_to_idx[home_team]
        a_idx = self.team_to_idx[away_team]
        
        # Calcular tasas esperadas de goles
        lambda_h = self.attack_params[h_idx] * self.defense_params[a_idx] * self.home_advantage
        mu_a = self.attack_params[a_idx] * self.defense_params[h_idx]
        
        # Generar distribución de Poisson para goles
        h_probs = poisson.pmf(np.arange(max_goals + 1), lambda_h)
        a_probs = poisson.pmf(np.arange(max_goals + 1), mu_a)
        
        # Asegurar que sumen 1 (normalizar colas de distribución)
        h_probs /= np.sum(h_probs)
        a_probs /= np.sum(a_probs)
        
        # Matriz de probabilidad conjunta
        # score_matrix[i, j] representa P(Home = i y Away = j)
        score_matrix = np.outer(h_probs, a_probs)
        
        # 1X2 Probabilidades
        prob_home = np.sum(np.triu(score_matrix, 1))  # Triángulo superior es Visita gana en base a indexación (x < y)
        # CUIDADO: np.triu es triángulo superior, en una matriz score_matrix[h, a]:
        # Si h > a, entonces gana local. Si h < a, gana visita.
        # Vamos a sumarlo manualmente por índices para evitar confusiones de triu/tril:
        prob_home = 0.0
        prob_draw = 0.0
        prob_away = 0.0
        prob_over25 = 0.0
        prob_btts = 0.0
        
        for h in range(max_goals + 1):
            for a in range(max_goals + 1):
                p = score_matrix[h, a]
                if h > a:
                    prob_home += p
                elif h < a:
                    prob_away += p
                else:
                    prob_draw += p
                    
                if h + a > 2:
                    prob_over25 += p
                    
                if h > 0 and a > 0:
                    prob_btts += p
                    
        return {
            'expected_goals_home': lambda_h,
            'expected_goals_away': mu_a,
            '1X2': {
                '1': prob_home,
                'X': prob_draw,
                '2': prob_away
            },
            'over_under_25': {
                'over': prob_over25,
                'under': 1.0 - prob_over25
            },
            'btts': {
                'yes': prob_btts,
                'no': 1.0 - prob_btts
            },
            'score_matrix': score_matrix
        }
