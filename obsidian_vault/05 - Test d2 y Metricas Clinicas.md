# ⏱️ 05 - Test d2 y Métricas Clínicas

El **Test de Atención d2** (Brickenkamp & Zillmer) es una de las pruebas neuropsicológicas estandarizadas más utilizadas para evaluar la atención selectiva, la atención sostenida y la velocidad de procesamiento visual bajo presión temporal.

---

## 📐 Estructura Psicométrica

* **Páginas / Líneas:** 14 páginas independientes.
* **Estímulos por Página:** 47 caracteres.
* **Tiempo Límite por Página:** **20 segundos** (automático y no pausable).
* **Estímulo Diana (Target):** Letra `d` con exactamente **2 rayitas** (distribuidas como: dos arriba, dos abajo, o una arriba y una abajo).
* **Distractores:**
  - Letra `p` con cualquier número de rayitas (1, 2, 3 o 4).
  - Letra `d` con 1, 3 o 4 rayitas.

---

## 🧮 Fórmulas Psicométricas Implementadas (`web/frontend/js/metrics.js`)

| Métrica | Nombre | Fórmula Matemática | Significado Clínico |
|---|---|---|---|
| **TN** | Total Evaluados | $\sum (\text{Aciertos} + \text{Omisiones})$ | Cantidad de estímulos revisados por el sujeto. |
| **TA** | Total Aciertos | $\sum \text{Dianas marcadas correctamente}$ | Capacidad de identificación positiva. |
| **O** | Omisiones | $\sum \text{Dianas no seleccionadas}$ | Falla en rastreo visual y alerta atencional. |
| **COM** | Comisiones | $\sum \text{Distractores marcados erróneamente}$ | Falla en control inhibitorio e impulsividad. |
| **TOT** | Total de Errores | $O + \text{COM}$ | Volumen absoluto de equivocaciones. |
| **CON** | Concentración Neta | $\text{TA} - \text{TOT}$ | Rendimiento real descontando penalizaciones. |
| **CP** | Porcentaje de Concentración | $(\text{CON} / \text{TN}) \times 100$ | Precisión relativa frente al total procesado. |
| **VAR** | Variabilidad de Rendimiento | $(\sigma_{\text{aciertos}} / \mu_{\text{aciertos}}) \times 100$ | Fluctuación rítmica entre páginas. |
| **TRM** | Tasa de Resistencia a la Fatiga | $((H_2 - H_1) / H_1) \times 100$ | Diferencia porcentual entre la segunda mitad ($H_2$) y la primera ($H_1$). |
| **IVR** | Índice de Velocidad de Respuesta | $\text{COM} / (\text{Velocidad} / 100)$ | Relación entre velocidad e impulsividad. |

---

## 🛑 Detección de Evaluaciones Incompletas

Si el evaluado se detiene antes de completar las 14 páginas (por ejemplo, fatiga severa o abandono):
* La plataforma detecta automáticamente `lastAttemptedIndex`.
* Marca `isIncomplete = true`.
* Normaliza las métricas proporcionalmente sobre las páginas intentadas para no sesgar injustamente la calificación ni arrojar errores matemáticos.

---

## 🔗 Enlaces Relacionados en la Bóveda
- [[00 - INDICE GENERAL DEL SISTEMA]]
- [[02 - Frontend y Experiencia de Usuario]]
- [[03 - Backend y Modelos de Inteligencia Artificial]]
- [[06 - Biomarcadores Digitales y Tremor]]
- [[08 - Exportacion y Reportes Excel]]
