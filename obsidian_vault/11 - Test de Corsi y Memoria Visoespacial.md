# 🧊 Test de Bloques de Corsi y Memoria de Trabajo Visoespacial (MecaPsi)

## 📌 1. Fundamento Neuropsicológico y Clínico

El **Test de Bloques de Corsi** (Corsi, 1972; Milner, 1971; Kessels et al., 2000) es la prueba de referencia para evaluar la **memoria a corto plazo visoespacial** y la **memoria de trabajo ejecutiva**.

En la plataforma **MecaPsi**, el test se digitalizó con una disposición espacial de 9 cubos 3D interactivos sobre fondo contrastado y calibrado ergonómicamente:

```mermaid
graph TD
    A["Test de Corsi (MecaPsi)"] --> B["Modalidad Directa"]
    A --> C["Modalidad Inversa"]
    B --> D["Bucle Visoespacial Pasivo (Retención Inmediata)"]
    C --> E["Ejecutivo Central + Manipulación Espacial Activa"]
```

### Modalidades Evaluadas:
1. **Modalidad Directa:**
   El evaluado debe reproducir la secuencia de cubos iluminados en el **mismo orden** en que fueron presentados.
   * *Mecanismo cerebral:* Bucle visoespacial dependiente de cortezas parietal y occipital derechas.
2. **Modalidad Inversa:**
   El evaluado debe reproducir la secuencia en **orden inverso** (del último al primero).
   * *Mecanismo cerebral:* Memoria de trabajo activa y manipulación de representaciones espaciales en la corteza prefrontal dorsolateral (DLPFC).

---

## 🧮 2. Métricas Psicométricas y Fórmulas Exactas

| Indicador | Símbolo | Definición / Fórmula | Interpretación Clínica |
| :--- | :--- | :--- | :--- |
| **Span Visoespacial** | `corsi_span` | Máxima longitud de secuencia completada correctamente (al menos 1 ensayo). | Amplitud de memoria inmediata (Norma típica: 5 a 6 bloques en adultos). |
| **Puntaje Compuesto** | `composite_score` | $\text{Span} \times \text{Total de Ensayos Correctos}$ | Rendimiento ponderado global (equilibrio entre capacidad y consistencia). |
| **Tasa de Precisión** | `accuracy_pct` | $\frac{\text{Ensayos Correctos}}{\text{Ensayos Totales}} \times 100$ | Porcentaje global de aciertos en la administración. |
| **Tiempo de Duda Previa** | `hesitation_time_avg_ms` | $t_{\text{primer\_clic}} - t_{\text{fin\_presentacion}}$ | Latencia de vacilación previa al inicio motor; refleja planificación ejecutiva y acceso mnémico. |
| **Tiempo de Reacción Medio** | `mean_reaction_time_ms` | $\frac{\sum \Delta t_{\text{bloques}}}{N - 1}$ | Velocidad media de secuenciación psicomotora entre clics. |

---

## ⚡ 3. Fusión Mecatrónica y Paraclínica (Hardware + Software)

El Test de Corsi integra la misma telemetría paraclínica en tiempo real de MecaPsi:

1. **Cinemática del Cursor (60 Hz):**
   * Muestreo continuo de posición del mouse $\{x, y, t\}$.
   * Cálculo del micro-temblor (*jitter* motor en $\text{px/s}^2$): $\text{Jitter} = \frac{1}{M}\sum |\vec{a}_{i} - \vec{a}_{i-1}|$.
   * Detección de temblor fino asociado a ansiedad o sobreesfuerzo motor (umbral clínico basal: $<85.0 \text{ px/s}^2$).

2. **Oculometría y Pupila (MediaPipe Face Mesh):**
   * **Apertura palpebral (EAR):** Frecuencia de parpadeos por minuto y desvíos atencionales.
   * **Pupilometría Cognitiva:** Detección de dilatación transitoria del iris ($>120\%$ sobre la línea base) durante la fase de retención previa al primer clic.
   * **Picos de Sobreesfuerzo:** Conteo de picos de carga cognitiva asociados a secuencias de alta complejidad.

3. **Expresión Facial (FER):**
   * Clasificación en tiempo real de expresiones faciales y cálculo del índice de tensión psicomotora (%) y eventos de frustración ante el error.

---

## 🔒 4. Flujo de Privacidad y Deontología Clínica

* **Bloqueo Obligatorio:** Al finalizar el test, el sistema navega obligatoriamente a la pantalla de finalización protegida (`completion`).
* **Candado del Profesional:** Requiere la contraseña del psicólogo titular para desbloquear el informe, asegurando que el paciente no interprete puntajes crudos sin acompañamiento.

---

## 📊 5. Visualización de Resultados e Historial

Tanto en la pantalla de resultados post-evaluación como en el botón **"👁️ Ver Web"** del **Historial**, se despliegan:

1. **Semáforos Normativos:** Span Visoespacial tipificado (Déficit $\le 3$, Límite $= 4$, Normativo $\ge 5$) y Puntaje Compuesto.
2. **Telemetría Paraclínica (4 Paneles):** Oculometría, FER, Cinemática a 60 FPS y Pupilometría IRIS.
3. **5 Subplots de Chart.js:**
   * Curva de Progresión Visoespacial (Nivel evaluado con puntos verde de acierto y rojo de fallo).
   * Cronometría Cognitiva (Duda previa vs TR medio).
   * Distribución de Precisión (Aciertos vs Fallos).
   * Campana Normativa de Gauss (Percentil poblacional según baremos de Kessels).
   * Dinámica Motora y Micro-temblor por Ensayo.
4. **Reproductor y Descargador de Video WebM:** Si la sesión contó con cámara activa.
5. **Desglose Ensayo por Ensayo:** Tabla con secuencia presentada, secuencia del usuario y latencias en milisegundos.

---

## 📁 6. Exportación Forense en Excel (`save_excel_corsi`)

El backend compila un libro `.xlsx` de 6 hojas mediante `openpyxl`:
* `01_Resumen_Clinico`: Ficha del paciente, Span, Puntaje Compuesto y métricas paraclínicas.
* `02_Desglose_Ensayos`: Matriz ensayo a ensayo con secuencias y tiempos de reacción.
* `03_Glosario_Metricas`: Diccionario conceptual y referencias normativas.
* `04_Registro_Eventos_CRUDOS`: Trazabilidad clic por clic con coordenadas y milisegundos transcurridos.
* `05_Vectores_Graficas`: Series numéricas tabuladas para análisis en SPSS o R.
* `06_XL_Visuales`: Panel de 4 gráficos vectoriales Matplotlib incrustados.

---
*Módulo Corsi MecaPsi · Diseñado para Bóveda de Conocimiento Obsidian*
