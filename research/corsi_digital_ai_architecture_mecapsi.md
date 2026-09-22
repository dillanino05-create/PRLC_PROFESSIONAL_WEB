# 🧊 Investigación Técnica y Clínica: Test de Bloques de Corsi Digital (CBT) & Arquitectura de IA en MecaPsi

**Autor:** Dilan Alejandro Lamus Pabón & Antigravity (Pair Programming)  
**Proyecto:** MecaPsi (PLC Professional) — Ecosistema Clínico Web  
**Fecha:** Septiembre 2026  
**Objetivo:** Definir el estado del arte de la versión online/digital del Test de Corsi, el modelo de Redes Neuronales Profundas (Keras MLP), el vector de 32 características, la pantalla final de resultados clínicos y el pipeline forense de exportación en Excel.

---

## 1. 🌐 Estado del Arte: De la Madera al Entorno Digital (CANTAB, PEBL y e-Corsi)

### 1.1 Origen y Limitaciones del Formato Físico
El **Test de Bloques de Corsi (CBT)** fue desarrollado originalmente por **Philip M. Corsi (1972)** en el *Montreal Neurological Institute* bajo la dirección de Brenda Milner, con el fin de evaluar la memoria a corto plazo y de trabajo espacial en pacientes con lesiones temporales y frontales.

En su formato analógico tradicional:
- Consta de **9 cubos de madera (3 × 3 cm)** montados asimétricamente sobre una tabla negra de madera.
- El evaluador toca físicamente los bloques con el dedo índice a un ritmo aproximado de 1 bloque por segundo.
- El paciente debe reproducir la secuencia tocando los mismos bloques en el mismo orden (**Corsi Directo / Forward**) o en orden inverso (**Corsi Inverso / Backward**).

**Vulnerabilidades Críticas del Formato Analógico:**
1. **Oclusión Visual del Evaluador:** Al mover la mano para tocar un cubo, el evaluador tapa visualmente otros cubos, afectando la codificación del paciente.
2. **Variabilidad en el Ritmo de Presentación:** Es imposible para un ser humano mantener exactamente 1.000 ms de presentación y 500 ms de intervalo inter-estímulo (ISI).
3. **Pérdida de Información Cronométrica:** El cronómetro manual solo registra el tiempo total del ensayo, perdiendo la latencia de planificación previa al primer toque y el ritmo de recuperación visomotriz.
4. **Error Humano de Registro:** El evaluador debe memorizar o mirar una hoja para verificar si el paciente tocó el cubo correcto, introduciendo un sesgo de error en secuencias complejas ($\ge 5$ cubos).

---

### 1.2 La Revolución Digital: El Estándar CANTAB Spatial Span (SSP) y e-Corsi
La digitalización computarizada resolvió estos problemas y es hoy el estándar de oro en neurociencia clínica (e.g., **CANTAB Spatial Span** de Cambridge Cognition, avalado por la FDA en ensayos clínicos):

| Parámetro | Versión Analógica de Madera | CANTAB SSP / e-Corsi Digital | MecaPsi Corsi 3D (Nuestra Propuesta) |
| :--- | :--- | :--- | :--- |
| **Presentación** | Manual (dedo del evaluador) | Cuadrados 2D en pantalla táctil | **Cubos 3D interactivos con sombreado y retroalimentación auditiva estandarizada** |
| **Cronometría** | Manual / Estimada | Milisegundos en pantalla táctil | **Precisión de microsegundos (`performance.now()`) con Canvas 60 Hz** |
| **Tiempo de Planificación (IRT)** | No medible | Medido automáticamente | **Initial Reaction Time (IRT) + Análisis de vacilación del cursor** |
| **Cinemática Visomotriz** | Inexistente | No registrada | **Microtemblor (Jitter a 60 FPS) y trayectorias curvas del mouse** |
| **Biomarcadores Fisiológicos** | Inexistente | Solo en laboratorios con cascos | **Pupilometría cognitiva (MediaPipe Iris) y parpadeo (EAR) a costo $0** |
| **Análisis de Errores** | Binario (Acierto / Fallo) | Acierto / Fallo / Intentos | **Desglose espacial: transposición, intrusión y distancia euclidiana de error** |

---

## 2. 🧠 ¿Qué Mide Exactamente el Test de Corsi? (Fundamentación Psicométrica)

### 2.1 El Modelo de Memoria de Trabajo de Baddeley & Hitch
Mientras que el **Digit Span (Retención de Dígitos)** mide el *Bucle Fonológico* (memoria verbal/auditiva), Corsi evalúa la **Agenda Visoespacial (Visuospatial Sketchpad)**:

1. **Modalidad Directa (Forward Span) — Memoria a Corto Plazo Espacial Pasiva:**
   - **Función:** Retención pura y codificación temporal de coordenadas espaciales sin manipulación mental.
   - **Sustrato Neurobiológico:** Red parieto-occipital ventral derecha y córtex parietal posterior.
   - **Baremos Normales (Adultos sanos, Kessels et al., 2000):**
     - Media: **$5.4 \pm 0.9$ cubos** (Rango típico: 5 a 7 cubos).
     - Niños (8–12 años): **3.8 a 4.9 cubos**.

2. **Modalidad Inversa (Backward Span) — Memoria de Trabajo Visoespacial Activa:**
   - **Función:** Manipulación ejecutiva, reorganización inversa en el espacio de trabajo mental e inhibición proactiva de la secuencia original.
   - **Sustrato Neurobiológico:** Córtex prefrontal dorsolateral bilateral (DLPFC), córtex prefrontal ventrolateral y ganglios basales.
   - **Baremos Normales:**
     - Media: **$4.7 \pm 1.0$ cubos** (Rango típico: 4 a 6 cubos).
     - Discrepancia esperada: Generalmente **1 bloque menos que el directo**.
     - **Signo de Alarma Clínica:** Una caída de $\ge 2$ cubos entre directo e inverso señala **falla ejecutiva frontal pura** con memoria de retención intacta (común en TDAH y etapas tempranas de demencia frontotemporal).

### 2.2 Índices Psicométricos Clave en Corsi Digital
- **Span Máximo:** La longitud más larga lograda con éxito (al menos 1 intento correcto).
- **Block-Product Score (BPS):**  
  $$\text{BPS} = \text{Span} \times \text{Total de Ensayos Acertados}$$  
  *Es la métrica más sensible según Kessels et al. (2008), ya que premia la consistencia y no solo el pico de suerte.*
- **Initial Reaction Time (IRT / Tiempo de Planificación):**  
  Tiempo entre el final de la secuencia mostrada y el primer clic del usuario. Una latencia muy baja ($<250\text{ ms}$) indica **impulsividad**; una latencia excesivamente alta ($>2.500\text{ ms}$) indica **lentificación cognitiva o sobrecarga ejecutiva**.
- **Inter-Tap Interval (ITI / Latencia Inter-Bloque):**  
  Tiempo transcurrido entre cada clic consecutivo. La variabilidad del ITI refleja la fluidez de la recuperación visoespacial.
- **Tipología de Errores Clínicos:**
  - *Error de Transposición:* Tocó los cubos correctos pero en el orden incorrecto (falla de secuenciación temporal).
  - *Error de Intrusión:* Tocó un cubo que nunca se iluminó (falla amnésica espacial).
  - *Distancia Euclidiana del Error:*  
    $$D_E = \sqrt{(X_{\text{marcado}} - X_{\text{objetivo}})^2 + (Y_{\text{marcado}} - Y_{\text{objetivo}})^2}$$  
    Si el sujeto se equivoca por un cubo vecino (baja distancia), la representación espacial estaba casi intacta. Si toca un cubo en el extremo opuesto (alta distancia), hay una pérdida total del mapa visoespacial.

---

## 3. 🤖 Diseño de la Red Neuronal para Corsi en MecaPsi

Al igual que en PLC (d2) diseñamos un modelo sobre 32 variables, para **Corsi** estructuramos un **Vector de 32 Características (Features)** que fusiona psicometría, cronometría sub-milisegúndica, resolución de errores y biomarcadores visomotores a 60 FPS:

### 3.1 Vector de 32 Características de Entrada para Corsi

| # | Variable (Feature) | Tipo / Unidad | Significado Clínico |
| :---: | :--- | :--- | :--- |
| **1** | `edad_normalizada` | Numérico [0 - 1] | Normalización z-score según grupo etario (6 a 85 años). |
| **2** | `lateralidad` | Categórico (-1, 0, 1) | Zurdo (-1), Ambidiestro (0), Diestro (1). |
| **3** | `span_directo_max` | Entero [2 - 9] | Amplitud máxima lograda en modalidad Forward. |
| **4** | `span_inverso_max` | Entero [2 - 8] | Amplitud máxima lograda en modalidad Backward. |
| **5** | `discrepancia_span` | Entero [-2 a 5] | $\text{Span}_{\text{directo}} - \text{Span}_{\text{inverso}}$. Indicador de brecha ejecutiva. |
| **6** | `ratio_span_inv_dir` | Flotante [0.2 - 1.2] | $\text{Span}_{\text{inverso}} / \text{Span}_{\text{directo}}$. Normal $\approx 0.85$. |
| **7** | `total_aciertos_dir` | Entero [0 - 16] | Número de ensayos directos aprobados. |
| **8** | `total_aciertos_inv` | Entero [0 - 16] | Número de ensayos inversos aprobados. |
| **9** | `block_product_dir` | Flotante [0 - 144] | $\text{Span}_{\text{dir}} \times \text{Aciertos}_{\text{dir}}$. Consistencia de retención. |
| **10** | `block_product_inv` | Flotante [0 - 128] | $\text{Span}_{\text{inv}} \times \text{Aciertos}_{\text{inv}}$. Consistencia ejecutiva. |
| **11** | `irt_medio_directo` | Milisegundos | Latencia de inicio (planificación) en secuencias directas. |
| **12** | `irt_medio_inverso` | Milisegundos | Latencia de inicio en secuencias inversas (sobrecosto mental). |
| **13** | `costo_ejecutivo_irt` | Milisegundos | $\text{IRT}_{\text{inverso}} - \text{IRT}_{\text{directo}}$. Costo de inversión mental. |
| **14** | `iti_medio_directo` | Milisegundos | Tiempo entre toques en secuencias directas. |
| **15** | `iti_medio_inverso` | Milisegundos | Tiempo entre toques en secuencias inversas. |
| **16** | `cv_iti_variabilidad` | Porcentaje (%) | Coeficiente de variación de latencia inter-clic (ritmo). |
| **17** | `pendiente_latencia_span` | Flotante (ms/bloque) | Tasa de incremento del tiempo de respuesta a mayor dificultad. |
| **18** | `tasa_errores_transposicion` | Porcentaje (%) | Porcentaje de fallos por orden incorrecto. |
| **19** | `tasa_errores_intrusion` | Porcentaje (%) | Porcentaje de fallos por tocar cubos ajenos a la secuencia. |
| **20** | `distancia_euclidiana_error` | Píxeles norm. | Distancia espacial media entre el error y el bloque objetivo. |
| **21** | `tasa_perseveraciones` | Porcentaje (%) | Repetición indebida del mismo cubo dentro del intento. |
| **22** | `primer_fallo_nivel_dir` | Entero [2 - 9] | Nivel en que falló por primera vez en directo. |
| **23** | `primer_fallo_nivel_inv` | Entero [2 - 8] | Nivel en que falló por primera vez en inverso. |
| **24** | `tasa_aprobacion_intento_1` | Porcentaje (%) | Eficiencia de acierto en el primer intento sin repetición. |
| **25** | `tiempo_total_sesion_s` | Segundos | Duración total de la batería Corsi. |
| **26** | `jitter_cinematico_mouse` | Flotante (px/ms²) | Microtemblor motor a 60 FPS durante la ejecución hacia los cubos. |
| **27** | `curvatura_trayectoria` | Ratio ($\ge 1.0$) | Distancia real recorrida / Distancia euclidiana mínima. |
| **28** | `cambios_rumbo_bruscos` | Entero | Número de desviaciones angulares $>45^\circ$ en pleno trayecto. |
| **29** | `velocidad_media_cursor` | px/s | Velocidad promedio de desplazamiento motriz. |
| **30** | `dilatacion_pupilar_retencion`| Normalizado z-score| Pupilometría MediaPipe Iris en la fase de memorización. |
| **31** | `tasa_parpadeo_fase_repro` | Parpadeos/min | Frecuencia de parpadeo durante la reproducción de la secuencia. |
| **32** | `banderas_perdida_foco` | Entero | Desconexiones de la ventana durante la prueba (Anti-Cheat). |

---

### 3.2 Topología del Modelo Keras MLP (`corsi_mlp_model_v1.keras`)

```
ENTRADA: Vector de 32 Features (Normalizado con StandardScaler)
  │
  ▼
Capa Densa 1 (128 neuronas, ReLU) + BatchNormalization + Dropout (0.3)
  │
  ▼
Capa Densa 2 (64 neuronas, ReLU) + Dropout (0.2)
  │
  ▼
Capa Densa 3 (32 neuronas, ReLU)
  │
  ▼
SALIDA: Capa Densa (6 clases, Activación Softmax)
```

**Perfiles Clínicos Estratificados:**
1. **Control Neurotípico:** Span acorde a la edad ($\ge 5$ directo, $\ge 4$ inverso), ratio B/F $\approx 0.85$, planificación adaptativa e IRT balanceado.
2. **Déficit Ejecutivo Frontal (TDAH / Disfunción Prefrontal):** Span directo normal ($\ge 5-6$), pero colapso agudo en inverso ($\le 3$), ratio B/F $< 0.60$ y alta tasa de errores de transposición.
3. **Compromiso Visoespacial Severo (Riesgo DCL / Amnesia Espacial):** Depresión simétrica en directo e inverso ($\le 3$), alta tasa de intrusión y elevada distancia euclidiana de error.
4. **Perfil Impulsivo (Falla Inhibitoria):** IRT anormalmente bajo ($<250\text{ ms}$), movimientos rápidos sin planificar y colapso súbito en secuencias medianas.
5. **Fatiga / Sobrecarga Cognitiva:** Rendimiento decreciente continuo, incremento exponencial del ITI y dilatación pupilar sostenida.
6. **Alteración Motora Periférica (Temblor):** Capacidad mnemónica intacta pero con alto Jitter motriz y curvatura de cursor excesiva.

---

## 4. 🖥️ La "Parte Final": Experiencia de Usuario y Dashboard Clínico

Así como en PLC (d2) el usuario concluye la 14ª línea y el sistema despliega el informe visual pericial, en **Corsi** la fase final debe estructurarse con la misma estética premium:

### 4.1 Pantalla de Resultados Interactiva en Frontend
1. **Cabecera de Dictamen Rápido:**
   - Badge del perfil clasificado por IA: `[ CONTROL NEUROTÍPICO · 96.4% CONFIANZA ]`
   - Banderas periciales: `[ VALIDADO ]`, `[ SIN SOSPECHA DE TRAMPA (0 SALIDAS) ]`, `[ RITMO VISOMOTOR HOMOGÉNEO ]`.
2. **Tablero Bento de Spans y Percentiles:**
   - **Span Directo:** Número de cubos + Percentil clínico poblacional ($P_{75}$).
   - **Span Inverso:** Número de cubos + Percentil clínico poblacional ($P_{65}$).
   - **Discrepancia Directo-Inverso:** Semáforo (Verde: 1 bloque; Amarillo: 2 bloques; Rojo: $\ge 3$ bloques).
   - **Block-Product Score:** Puntaje compuesto de consistencia.
3. **Visualizador de Trayectorias y Mapa de Calor Espacial:**
   - Un mini-lienzo que dibuja los 9 cubos de Corsi mostrando en líneas de neón cian/magenta las **rutas reales que recorrió el mouse** del paciente en cada nivel, destacando visualmente dónde ocurrió el error.
4. **Gráfico Radar de 5 Ejes Neuropsicológicos:**
   - Eje 1: Amplitud Mnemónica Directa (Retención Espacial).
   - Eje 2: Flexibilidad y Manipulación Inversa (Control Ejecutivo).
   - Eje 3: Velocidad y Fluidez de Respuesta (Cronometría).
   - Eje 4: Estabilidad y Coordinación Visomotriz (Cinemática / Jitter).
   - Eje 5: Precisión Espacial (Baja Tasa de Intrusión).
5. **Botones de Acción:**
   - `[ 📥 Descargar Informe Forense en Excel (.xlsx) ]`
   - `[ 📄 Generar Certificado Clínico en PDF ]`
   - `[ 🔗 Unificar con Prueba PLC (Informe Integral MecaPsi) ]`

---

## 5. 📑 Pipeline de Exportación Forense en Excel (`corsi_excel_export.py`)

Siguiendo el estándar de oro implementado para PLC con `openpyxl`, el módulo de Corsi compila automáticamente un libro de cálculo de **5 hojas protegidas y formateadas estéticamente**:

- **Hoja 1: Resumen Ejecutivo y Diagnóstico IA:**
  - Ficha técnica del paciente (ID anónimo, edad, lateralidad, psicólogo evaluador).
  - Resultados globales: Spans directos e inversos, percentiles normativos y Block-Product.
  - Perfil emitido por la Red Neuronal MLP Keras con probabilidades de cada clase.
  - Gráfico de barras embebido que compara el rendimiento del paciente vs baremos esperados.
- **Hoja 2: Desglose Nivel por Nivel (Matriz de Secuencias):**
  - Registro de cada nivel presentado (desde 2 cubos hasta el fallo final).
  - Secuencia mostrada vs. Secuencia ingresada por el paciente.
  - Color condicional automático (Verde: Éxito; Rojo: Fallo).
  - Clasificación de error (Transposición, Intrusión, Omisión).
- **Hoja 3: Telemetría Cronométrica de Milisegundos:**
  - Registro del tiempo de visualización, tiempo de vacilación inicial (IRT) y latencia entre cubos (ITI).
  - Gráfico de dispersión de velocidad de respuesta vs longitud del Span.
- **Hoja 4: Biomarcadores y Cinemática Visomotriz:**
  - Desglose de aceleraciones del cursor, temblor motor (Jitter) y distancia euclidiana de error.
  - Métricas de visión ocular (EAR y pupilometría normalizada).
- **Hoja 5: Cadena de Custodia y Auditoría Forense:**
  - Hash criptográfico SHA-256 del archivo y de los eventos crudos.
  - Timestamp UTC con zona horaria de Colombia.
  - Cláusula legal estricta de **Soporte Clínico No Patologizante (CDSS)** bajo la Ley 1581 de 2012.

---

## 6. 🏆 El Gran Moat: El Informe Clínico Integral MecaPsi (PLC + Corsi)

La ventaja competitiva más potente de MecaPsi frente a cualquier software tradicional es la **fusión multimodal de dos baterías de referencia en una sola sesión**:

$$\begin{aligned}
\text{\textbf{Test d2 (PLC)}} &\longrightarrow \text{Atención Selectiva, Concentración y Resistencia a la Fatiga} \\
\text{\textbf{Cubos de Corsi}} &\longrightarrow \text{Memoria de Trabajo Visoespacial y Control Ejecutivo Frontal}
\end{aligned}$$

Al cruzar ambas pruebas en el backend:
- Si el paciente falla en **d2 (altas omisiones)** pero tiene **Corsi normal**, el problema es de **alerta/rastreo visual periférico**, no de memoria ejecutiva.
- Si el paciente tiene **d2 normal** pero **colapsa en Corsi inverso**, la dificultad reside en la **manipulación y memoria de trabajo frontal**, descartando un problema de atención sostenida básica.
- Si ambos tests muestran **altas comisiones, clics impulsivos y bajo tiempo de planificación**, se genera una **fuerte bandera pericial de TDAH subtipo combinado o impulsividad severa**.

---

## 7. 🚀 Plan de Acción Inmediato para MecaPsi

1. **Frontend:**
   - Diseñar el flujo de prueba completo de Corsi (Fase 1: Instrucciones y práctica; Fase 2: Modalidad Directa; Fase 3: Modalidad Inversa; Fase 4: Pantalla final de resultados).
2. **Backend:**
   - Crear el endpoint de inferencia `POST /api/predict/corsi` en FastAPI.
   - Desarrollar el generador de reportes Excel `web/backend/corsi_excel_export.py` con `openpyxl`.
3. **Inteligencia Artificial:**
   - Crear el script de síntesis normativa de datos y entrenamiento del modelo `corsi_mlp_model_v1.keras` con Scikit-Learn y Keras sobre el vector de 32 variables.
4. **Base de Datos:**
   - Crear la tabla `corsi_evaluations` en Supabase con políticas RLS para aislamiento multi-tenant.
