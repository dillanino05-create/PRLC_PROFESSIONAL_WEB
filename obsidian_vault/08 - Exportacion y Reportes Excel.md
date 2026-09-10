# 📊 08 - Exportación y Reportes Excel

El módulo `web/backend/excel_export.py` compila reportes clínicos neuropsicológicos de grado profesional en formato `.xlsx` utilizando la librería `openpyxl`.

---

## 📑 Estructura del Libro de Cálculo

El archivo generado consta de dos hojas de cálculo altamente estructuradas con diseño visual profesional:

### Hoja 1: "Resumen Clínico"

- **Encabezado Institucional:** Datos del evaluado (Nombre, Documento, Edad, Escolaridad, Mano dominante, Fecha).
- **Diagnóstico del Modelo de Inteligencia Artificial (MLP):** Perfil clasificado y porcentaje de confianza predictiva.
- **Tabla de Métricas Clínicas Principales:** $TN, TA, O, COM, TOT, CON, CP, FA, GQ, VAR, TRM, IVR$.
- **Sección de Biomarcadores Motores Digitales:** Resumen del Temblor del Cursor (promedio de Jitter, páginas con alerta de tremor motor y observaciones cinemáticas).
- **Interpretación Neurocognitiva Automatizada:** Narrativa clínica generada para adjuntar en la historia clínica del paciente.

### Hoja 2: "Análisis por Línea"

- Desglose minucioso de cada una de las 14 páginas del test:
  - Estímulos diana totales por línea.
  - Aciertos ($TA$).
  - Omisiones ($O$).
  - Comisiones ($COM$).
  - Estímulos evaluados hasta el último clic.
  - Tiempo empleado por página (s) y porcentaje del tiempo total.
  - Saltos erráticos / retrocesos en el barrido visual.
  - **Tremor Score (Jitter Motor):** Puntuación cuantitativa de temblor del mouse.
  - **⚠️ Indicador Temblor Motor:** `NORMAL` o `⚠️ ALERTA MOTOR`.

---

## ⚙️ Generación en Background

Cuando el frontend envía `POST /api/evaluations/save`, la respuesta HTTP retorna de inmediato al navegador (`200 OK`) mientras la generación del Excel se delega a `BackgroundTasks` de FastAPI (`process_excel_bg`). Esto garantiza que la interfaz de usuario nunca se congele esperando el procesamiento del archivo.

---

## 🔗 Enlaces Relacionados en la Bóveda

- [[00 - INDICE GENERAL DEL SISTEMA]]
- [[03 - Backend y Modelos de Inteligencia Artificial]]
- [[05 - Test d2 y Metricas Clinicas]]
- [[06 - Biomarcadores Digitales y Tremor]]
