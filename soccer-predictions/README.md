# Modelo de Predicción de Apuestas de Fútbol (Poisson / Dixon-Coles)

Este es un subproyecto aislado para pronosticar probabilidades en partidos de fútbol y encontrar apuestas con **Valor Esperado Positivo (+EV)**, usando regresión de Poisson para modelar la habilidad de ataque y defensa de los equipos.

## Estructura
*   `download_data.py`: Descarga y combina datos históricos de partidos y cuotas.
*   `model.py`: Implementación matemática de la regresión Poisson de Máxima Verosimilitud (MLE).
*   `predict.py`: Consola CLI interactiva para entrenar, ver la tabla de fuerza de los equipos y predecir partidos.

---

## Configuración y Setup

1.  **Crear el entorno virtual (dentro de esta carpeta `soccer-predictions`):**
    ```bash
    python -m venv .venv
    ```

2.  **Activar el entorno virtual:**
    *   **Windows (PowerShell):**
        ```powershell
        .venv\Scripts\Activate.ps1
        ```
    *   **Windows (CMD):**
        ```cmd
        .venv\Scripts\activate.bat
        ```
    *   **Mac/Linux:**
        ```bash
        source .venv/bin/activate
        ```

3.  **Instalar dependencias:**
    ```bash
    pip install -r requirements.txt
    ```

---

## Cómo usar el Sistema

### Paso 1: Descargar Datos
Descarga los datos de las temporadas recientes (ej. 2023/24 y 2024/25) para entrenar el modelo.
*   **La Liga de España (por defecto):**
    ```bash
    python download_data.py --league SP1 --seasons 2324,2425
    ```
*   **Premier League de Inglaterra:**
    ```bash
    python download_data.py --league E0 --seasons 2324,2425
    ```

### Paso 2: Ver Clasificación de Fuerza de los Equipos
Si ejecutas `predict.py` sin argumentos de equipos, el modelo se entrenará y mostrará los parámetros de ataque y defensa de cada equipo de la liga:
```bash
python predict.py --league SP1
```
*Ataque > 1.0 es mejor que el promedio. Defensa < 1.0 es mejor que el promedio.*

### Paso 3: Predecir un Partido y Buscar Valor (+EV)
Puedes predecir un partido específico ingresando el nombre de los equipos. Opcionalmente, ingresa las cuotas reales de tu casa de apuestas para ver si tiene **Valor Esperado (+EV)**:

```bash
python predict.py --league SP1 --home "Real Madrid" --away "Barcelona" --odds-1 1.95 --odds-x 3.80 --odds-2 3.60
```

El script te dará:
*   Los goles esperados para cada equipo.
*   Las probabilidades de victoria Local, Empate y Visitante (1X2) y sus cuotas justas correspondientes.
*   Las probabilidades de goles (Over/Under 2.5) y Ambos Anotan (BTTS).
*   **Análisis de Valor (+EV):** Si la cuota de la casa es mayor que la cuota justa de tu modelo, te indicará el porcentaje de retorno esperado (+EV).
*   Los 5 marcadores exactos más probables.
