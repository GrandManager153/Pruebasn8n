#!/usr/bin/env python
# -*- coding: utf-8 -*-

import os
import sys
import argparse
import requests
import pandas as pd

# Diccionario de ligas comunes y sus códigos en Football-Data.co.uk
LEAGUES = {
    "SP1": "La Liga (España)",
    "SP2": "Segunda División (España)",
    "E0": "Premier League (Inglaterra)",
    "E1": "Championship (Inglaterra)",
    "I1": "Serie A (Italia)",
    "D1": "Bundesliga (Alemania)",
    "F1": "Ligue 1 (Francia)",
    "N1": "Eredivisie (Países Bajos)",
    "P1": "Liga Portugal (Portugal)"
}

BASE_URL = "https://www.football-data.co.uk/mmz4281/{season}/{league}.csv"

def download_season_data(league, season):
    """
    Descarga el archivo CSV para una liga y temporada específica.
    Ejemplo season: '2324' para 2023/2024.
    """
    url = BASE_URL.format(season=season, league=league)
    print(f"[Descarga] Descargando {LEAGUES.get(league, league)} temporada {season}...")
    print(f"   URL: {url}")
    
    try:
        # User-Agent para evitar bloqueos simples
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
        response = requests.get(url, headers=headers, timeout=15)
        
        if response.status_code == 200:
            # Escribir contenido temporalmente o leer con pandas directamente
            # Usaremos pandas para validar y limpiar en memoria
            from io import StringIO
            df = pd.read_csv(StringIO(response.text))
            print(f"   [OK] Descargado con exito: {len(df)} partidos encontrados.")
            return df
        elif response.status_code == 404:
            print(f"   [Error 404] No se encontraron datos para la temporada {season}. ¿Ya comenzo?")
            return None
        else:
            print(f"   [Error {response.status_code}] al descargar datos.")
            return None
    except Exception as e:
        print(f"   [Exception] Excepcion al descargar: {e}")
        return None

def main():
    parser = argparse.ArgumentParser(description="Descargador de datos históricos de fútbol (Football-Data.co.uk)")
    parser.add_argument("--league", type=str, default="SP1", choices=list(LEAGUES.keys()),
                        help="Código de la liga a descargar (por defecto SP1 - La Liga de España)")
    parser.add_argument("--seasons", type=str, default="2324,2425",
                        help="Temporadas separadas por comas (ej. 2223,2324,2425)")
    
    args = parser.parse_args()
    
    league = args.league.upper()
    seasons = [s.strip() for s in args.seasons.split(",")]
    
    # Crear directorio data/ si no existe
    os.makedirs("data", exist_ok=True)
    
    all_dfs = []
    
    for season in seasons:
        df = download_season_data(league, season)
        if df is not None and not df.empty:
            # Agregar columna de control para la temporada
            df["Season"] = season
            all_dfs.append(df)
            
    if not all_dfs:
        print("[Error] No se pudo descargar ningun dato. Abortando.")
        sys.exit(1)
        
    # Combinar todas las temporadas
    merged_df = pd.concat(all_dfs, ignore_index=True)
    
    # Columnas mínimas requeridas para el modelo predictivo:
    # Date, HomeTeam, AwayTeam, FTHG (Full Time Home Goals), FTAG (Full Time Away Goals)
    required_cols = ["Date", "HomeTeam", "AwayTeam", "FTHG", "FTAG"]
    
    # Verificar si están presentes las columnas necesarias
    missing_cols = [col for col in required_cols if col not in merged_df.columns]
    if missing_cols:
        print(f"[Error] El dataset no tiene las columnas necesarias: {missing_cols}")
        sys.exit(1)
        
    # Limpieza básica: Eliminar filas vacías en HomeTeam o AwayTeam
    initial_len = len(merged_df)
    merged_df = merged_df.dropna(subset=["HomeTeam", "AwayTeam", "FTHG", "FTAG"])
    
    # Convertir goles a enteros
    merged_df["FTHG"] = merged_df["FTHG"].astype(int)
    merged_df["FTAG"] = merged_df["FTAG"].astype(int)
    
    # Mostrar resumen
    print("\n[Resumen] Resumen del Dataset Combinado:")
    print(f"   - Total de partidos validos: {len(merged_df)} (de un total de {initial_len})")
    print(f"   - Equipos unicos encontrados: {merged_df['HomeTeam'].nunique()}")
    print(f"   - Goles locales promedio: {merged_df['FTHG'].mean():.2f}")
    print(f"   - Goles visitantes promedio: {merged_df['FTAG'].mean():.2f}")
    
    # Guardar archivo combinado
    output_path = os.path.join("data", f"{league}_merged.csv")
    merged_df.to_csv(output_path, index=False)
    print(f"\n[Archivo] Dataset guardado con exito en: {output_path}")

if __name__ == "__main__":
    main()
