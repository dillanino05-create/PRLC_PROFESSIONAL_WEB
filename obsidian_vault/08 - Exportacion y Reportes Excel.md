# 📊 08 - Exportación y Reportes Excel

El módulo `web/backend/excel_export.py` compila reportes clínicos neuropsicológicos de grado profesional en formato `.xlsx` utilizando la librería `openpyxl`.

---

## 📑 Estructura del Libro de Cálculo (5 Hojas Especializadas)

El archivo `.xlsx` generado por `excel_export.py` consta de cinco hojas de cálculo estructuradas con diseño visual profesional para historia clínica y peritaje forense:

### Hoja 1: "01_Resumen_Clinico"
- **Encabezado Institucional:** Datos del evaluado anonimizado (`ID: ******829`, Edad, Escolaridad, Mano dominante, Fecha).
- **Métricas Clínicas Principales:** $TN, TA, O, COM, TOT, CON, CP, FA, GQ, VAR, TRM, IVR$.
- **Patrones Observacionales Algorítmicos:** Perfil primario de la Red Neuronal Keras (MLP).
- **Notas de Barrido Visual:** Registro de saltos erráticos y retrocesos de línea.
- **Biomarcadores Motores Digitales:** Jitter del cursor y páginas con alerta de tremor motor.

### Hoja 2: "02_Analisis_Lineas"
- Desglose minucioso de cada una de las 14 líneas de 20 segundos del test:
  - Estímulos diana totales y evaluados hasta el último clic.
  - Aciertos ($TA$), Omisiones ($O$) y Comisiones ($COM$).
  - Saltos erráticos / retrocesos en el barrido visual.
  - Latencia invertida por línea (s) y porcentaje de exactitud.
  - **Tremor Score (Jitter Motor):** Puntuación cuantitativa de aceleración del mouse.
  - **⚠️ Indicador Temblor Motor:** `Normal` o `SÍ — Variabilidad cinemática elevada`.

### Hoja 3: "03_Glosario_Metricas"
- Diccionario biomédico estandarizado con acrónimos, terminología clínica y definición teórica de cada indicador ($TA, O, COM, CON, CP\%, TRM, IVR$).

### Hoja 4: "04_Registro_Eventos_CRUDOS"
- Auditoría milimétrica clic por clic a nivel de milisegundo (`elapsed_ms`), línea, columna visomotora y acción emitida para validez legal y peritaje forense.

### Hoja 5: "05_Arrays_Para_Graficas"
- Matrices vectoriales crudas para análisis estadístico (SPSS / R / Python) y 3 gráficos vectoriales nativos incrustados (`openpyxl` charts): Curva de Aciertos, Tasa de Falla (O vs C vs SE) y Saltos Erráticos.
- Gráfica compuesta de 6 paneles generada por Matplotlib (`_charts_png`).

---

## ⚙️ Generación en Background

Cuando el frontend envía `POST /api/evaluations/save`, la respuesta HTTP retorna de inmediato al navegador (`200 OK`) mientras la generación del Excel se delega a `BackgroundTasks` de FastAPI (`process_excel_bg`). Esto garantiza que la interfaz de usuario nunca se congele esperando el procesamiento del archivo.

---

## 🔗 Enlaces Relacionados en la Bóveda

- [[00 - INDICE GENERAL DEL SISTEMA]]
- [[03 - Backend y Modelos de Inteligencia Artificial]]
- [[05 - Test d2 y Metricas Clinicas]]
- [[06 - Biomarcadores Digitales y Tremor]]
