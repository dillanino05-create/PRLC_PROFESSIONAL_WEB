# ⏱️ 05 - Prueba de Líneas Cruzadas (PLC) y Métricas Psicométricas

La **Prueba de Líneas Cruzadas (PLC)** (batería insignia de atención en **PLC Professional / MecaPsi**) adopta rigurosamente el paradigma experimental y la dinámica operativa del **Test de Atención d2** (Rolf Brickenkamp & Dirk Zillmer; d2-R; TEA Ediciones). Evalúa la atención selectiva, la atención sostenida y la velocidad de procesamiento visual bajo presión temporal cronometrada.

---

## 📐 Estructura Psicométrica de PLC

- **Páginas / Líneas:** 14 páginas independientes.
- **Estímulos por Página:** 47 caracteres alfanuméricos.
- **Tiempo Límite por Página:** **20 segundos** (automático y no pausable).
- **Estímulo Diana (Target):** Letra `d` con exactamente **2 rayitas** (distribuidas como: dos arriba, dos abajo, o una arriba y una abajo).
- **Distractores:**
  - Letra `p` con cualquier número de rayitas (1, 2, 3 o 4).
  - Letra `d` con 1, 3 o 4 rayitas.

---

## 🧮 Fórmulas Psicométricas Oficiales (`web/frontend/js/metrics.js`)

| Métrica | Nombre | Fórmula Matemática | Significado Clínico y Estándar |
| --- | --- | --- | --- |
| **TR** | Total de Respuestas | $\sum \text{Caracteres procesados}$ | Volumen total de elementos inspeccionados por línea. |
| **TA** | Total Aciertos | $\sum \text{Dianas marcadas correctamente}$ | Capacidad de identificación positiva (Hits). |
| **O** | Omisiones | $\sum \text{Dianas no seleccionadas}$ | Falla en rastreo visual y alerta atencional. |
| **COM** | Comisiones | $\sum \text{Distractores marcados erróneamente}$ | Falla en control inhibitorio e impulsividad (Falsas Alarmas). |
| **E** | Total de Errores | $O + \text{COM}$ | Volumen absoluto acumulado de fallos. |
| **CON** | Concentración Oficial | $\mathbf{TA - COM}$ | **Norma Oficial TEA Ediciones:** Mide la selectividad real sin penalizar doblemente las omisiones (las omisiones ya deprimen $TA$). |
| **TOT** | Efectividad Total | $\mathbf{TR - (O + COM)}$ | **Norma Brickenkamp:** Rendimiento global descontando el total de errores del total de caracteres procesados. |
| **CP %** | Porcentaje de Concentración | $(\text{CON} / \text{TN}) \times 100$ | Precisión relativa frente al total procesado. |
| **E %** | Porcentaje de Error | $((O + \text{COM}) / \text{TR}) \times 100$ | **Norma d2-R:** Proporción cualitativa de error sobre el trabajo abordado. |
| **VAR** | Variabilidad de Rendimiento | $(\sigma_{\text{aciertos}} / \mu_{\text{aciertos}}) \times 100$ | Fluctuación rítmica entre páginas. |
| **TRM** | Tasa de Resistencia a la Fatiga | $((H_2 - H_1) / H_1) \times 100$ | Diferencia porcentual entre la segunda mitad ($H_2$) y la primera ($H_1$). |
| **IVR** | Índice de Velocidad de Respuesta | $\text{COM} / (\text{Velocidad} / 100)$ | Relación entre velocidad e impulsividad motora. |

---

## 🧠 Innovaciones Psicométricas Avanzadas en PLC (El "Moat" Científico)

### 1. Teoría de Detección de Señales (SDT - Hautus, 1995)
Modela la toma de decisiones cognitivas frente al ruido visual:
- **Sensibilidad ($d'$):** $d' = Z(\text{Hit Rate}) - Z(\text{False Alarm Rate})$. Desacopla la agudeza perceptiva sensorial pura de la velocidad motora.
- **Criterio de Decisión ($c$):** $c = -0.5 \cdot [Z(\text{Hit}) + Z(\text{FA})]$.
  - $c > +0.25$: Criterio **Conservador / Cauteloso** (prioriza evitar comisiones).
  - $c < -0.25$: Criterio **Laxo / Impulsivo** (prioriza velocidad, asumiendo comisiones).
  - $-0.25 \le c \le +0.25$: Criterio **Equilibrado**.

### 2. Cronometría de Lapsos Atencionales (Micro-pausas $\ge 1.500\text{ ms}$)
- Registro milimétrico en `clickLog` de pausas $\ge 1.5$ s entre selecciones consecutivas.
- Biomarcador neurobiológico cardinal de lapsos en la red frontoparietal y locus coeruleus-noradrenalina (LC-NE), típico en TDAH y fatiga cognitiva aguda.

---

## 🛑 Detección de Evaluaciones Incompletas

Si el evaluado se detiene antes de completar las 14 páginas (por fatiga severa o abandono):
- La plataforma detecta automáticamente `lastAttemptedIndex`.
- Marca `isIncomplete = true`.
- Normaliza las métricas proporcionalmente sobre las páginas intentadas para no sesgar injustamente la calificación ni arrojar errores matemáticos.

---

## 🔗 Enlaces Relacionados en la Bóveda

- [[00 - INDICE GENERAL DEL SISTEMA]]
- [[02 - Frontend y Experiencia de Usuario]]
- [[03 - Backend y Modelos de Inteligencia Artificial]]
- [[06 - Biomarcadores Digitales y Tremor]]
- [[08 - Exportacion y Reportes Excel]]
