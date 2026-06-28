# 🧠 Ecosistema MecaPsi: Estado Tecnológico Actual (Baseline Completo)
> **Última actualización:** Abril 2026 | **Versión:** 2.0 (Auditoría Completa)

Este documento es la **auditoría técnica sin omisiones** de todo lo que existe y funciona hoy en el ecosistema MecaPsi. Cubre infraestructura cloud, código fuente, modelo de IA, seguridad, diseño y métricas de rendimiento. Es el punto de partida real antes de escalar.

---

## 1. 🏗️ INFRAESTRUCTURA CLOUD (El "Stack" Completo)

El ecosistema opera completamente en la nube con **costo operativo cercano a $0**, apoyado en los niveles gratuitos de servicios líderes:

| Servicio | Rol | Plan | URL/Referencia |
|---|---|---|---|
| **Vercel** | Hosting del Frontend (HTML/CSS/JS) | Free Tier | Dominio `.vercel.app` |
| **Supabase** | Base de Datos + Auth + Storage | Free Tier (500MB DB, 1GB Storage) | Proyecto activo |
| **Hugging Face** | Hosting del modelo IA / API de inferencia | Free Tier (Spaces) | Space con FastAPI |
| **GitHub** | Control de versiones del código fuente | Free (repo privado/público) | Repositorio del proyecto |

**Principio de diseño:** Arquitectura *Bootstrapping* — el proyecto puede escalar de 10 a 10,000 usuarios antes de necesitar un plan de pago.

---

## 2. 🗃️ BASE DE DATOS: Supabase (PostgreSQL)

### 2.1 Tabla Principal: `evaluations`
Almacena cada sesión completada de la Prueba de Líneas Cruzadas. Los campos clave incluyen:

- `id` — UUID único de la evaluación
- `user_id` — FK hacia Supabase Auth (el psicólogo propietario del registro)
- `paciente_nombre`, `paciente_edad`, `paciente_sexo` — Datos demográficos capturados en el formulario pre-prueba
- `raw_data` — JSON con el log completo de la sesión (aciertos, errores, tiempos por ítem en arrays)
- `prediction` — Perfil clínico predicho por el MLP (ej. `"P0 - Base Normativa"`)
- `confidence` — Porcentaje de confianza Softmax del modelo (ej. `98.5`)
- `narrative` — Texto narrativo descriptivo del perfil generado automáticamente
- `status` — Estado del reporte: `"pending"` → `"completed"` (actualizado por la Cola FIFO)
- `export_path` — Ruta interna en Supabase Storage del Excel generado
- `created_at` — Timestamp UTC del momento de la evaluación

### 2.2 Seguridad a Nivel de Fila (RLS)
Todas las tablas tienen habilitado el sistema de **Row Level Security (RLS)** de Supabase. Esto significa que aunque dos psicólogos compartan el mismo servidor de base de datos, las consultas SQL de cada usuario están filtradas automáticamente por su `user_id` via token JWT. Un psicólogo **jamás** puede leer los registros de otro.

### 2.3 Supabase Auth (Autenticación)
- Sistema de registro e inicio de sesión implementado.
- Tokens **JWT** (JSON Web Token) emitidos por Supabase son validados en cada petición al Backend (`sb.auth.get_user(token)`).
- La sesión del usuario se persiste localmente en el navegador.

### 2.4 Supabase Storage (Bucket `exports`)
- Almacena los archivos Excel (`.xlsx`) generados por el backend tras cada evaluación.
- Los archivos NO son públicos.
- Se acceden exclusivamente mediante **Signed URLs (URLs Firmadas)** con tiempo de expiración de 60 segundos.

---

## 3. 🐍 BACKEND: Motor Python (FastAPI)

Ubicación: `backend/main.py` y `backend/predictor.py`

### 3.1 Endpoints Principales

| Endpoint | Método | Función |
|---|---|---|
| `/api/save` | `POST` | Recibe el JSON de la prueba, infiere el perfil IA, guarda en Supabase y encola la generación del reporte |
| `/api/history` | `GET` | Devuelve el historial de evaluaciones del psicólogo autenticado |
| `/api/export/{eval_id}` | `GET` | Genera una Signed URL de 60s para descargar el Excel del registro |
| `/api/delete/{eval_id}` | `DELETE` | Elimina la evaluación de la tabla SQL y el archivo del bucket Storage en cascada |
| `/api/health` | `GET` | Endpoint de diagnóstico: reporta si el modelo IA está cargado y listo |

### 3.2 Procesamiento Asíncrono: la Cola FIFO (`asyncio.Queue`)
Este es el componente de "grado enterprise" más importante del backend actual:

**Problema que resuelve:** Generar gráficas con `matplotlib` + empaquetar un Excel `.xlsx` + subirlo a la nube es una operación CPU/I-O intensiva que tarda entre 2,000ms y 4,000ms. Si esto bloqueara el servidor, 5 pacientes simultáneos harían colapsar el sistema.

**Implementación:**
1. La API `/api/save` realiza únicamente la tarea rápida: guarda en la DB con `status: "pending"` y devuelve éxito al cliente en **~50ms**.
2. El trabajo pesado (gráficas + Excel + subida a Storage) se deposita en la cola: `task_queue.put_nowait(payload)`.
3. Un worker background (`sequential_worker()`) corre en paralelo y procesa tareas una por una, sin bloquear el hilo principal del servidor.
4. Al finalizar, fuerza liberación de RAM con `gc.collect()`.

**Resultado:** El servidor puede recibir **n peticiones simultáneas** sin degradarse. La latencia percibida por el usuario es de ~50ms (un guardar instantáneo), no de 4,000ms.

### 3.3 Seguridad: Signed URLs y Prevención IDOR
- `/api/export/{eval_id}` nunca expone archivos directamente ni genera URLs permanentes.
- Solicita a Supabase Storage: `create_signed_url(filename, 60)`.
- La URL resultante expira en **60 segundos exactos**. Después, el enlace es matemáticamente imposible de usar. Esto previene la fuga de datos clínicos privados (vulnerabilidad tipo **IDOR**).

---

## 4. 🤖 MODELO DE INTELIGENCIA ARTIFICIAL (MLP)

Ubicación del código: `backend/predictor.py`
Archivos del modelo: `d2_mlp_model_v3.keras` + scaler `joblib`

### 4.1 Dataset de Entrenamiento
- **Tipo de datos:** Dataset Sintético Experto — 14,000 perfiles generados bajo reglas neuropsicológicas controladas.
- **Preprocesamiento:** Estandarización con `StandardScaler` (media=0, varianza=1) para igualar la escala entre variables de tiempo (ms) y variables porcentuales.
- **División:** 80% entrenamiento (11,200 muestras) / 20% validación (2,800 muestras).

### 4.2 Arquitectura del Modelo
- **Tipo:** Perceptrón Multicapa (MLP) — Red Neuronal Profunda de clasificación multiclase.
- **Framework:** `TensorFlow / Keras`.
- **Entrada:** Vector de **32 características** calculadas a partir de los datos crudos.
- **Salida:** Probabilidad Softmax sobre 8 clases (perfiles clínicos).

### 4.3 Las 32 Características (Feature Engineering)
El modelo no recibe datos crudos directamente. El sistema calcula un vector rico de 32 variables que incluye:
- `TT` — Tiempo Total de la prueba
- `TA`, `O`, `C` — Totales de Aciertos, Omisiones y Comisiones
- `CP` — Capacidad de Concentración ponderada por factor de edad (`af`)
- `GQ` — Cociente de Eficiencia Geométrica
- `bh` — Fluctuación de atención por bloques (variable de fatiga)
- Tiempos de reacción por cuartil (Q1-Q4)
- Aceleración y varianza de velocidad por línea
- Y más métricas derivadas de la curva de desempeño temporal.

### 4.4 Rendimiento del Modelo
- **Train Accuracy:** ~97.5%
- **Validation Accuracy:** ~97.0%
- **Convergencia:** Antes del Epoch 10 de 40 (sin overfitting)
- **Latencia de Inferencia:** ~10-20ms (en CPU del servidor)

### 4.5 Los 8 Perfiles Clínicos Normativos
| Código | Perfil |
|---|---|
| P0 | Base Normativa |
| P1 | Latencia con Omisión |
| P2 | Alta Reactividad |
| P3 | Varianza Bilateral |
| P4 | Latencia Sostenida |
| P5 | Desempeño Descendente |
| P6 | Alta Eficiencia |
| P7 | Restricción de Respuesta |

---

## 5. 🖥️ FRONTEND: La Interfaz de la Prueba (PLC)

Ubicación: `frontend/` → `index.html`, `css/style.css`, `js/app.js`, `js/metrics.js`, `js/stimuli.js`, `js/charts.js`

### 5.1 Flujo Operativo Actual (Paso a Paso)
1. **Login:** Pantalla de autenticación con Supabase Auth.
2. **Formulario Pre-Prueba:** Captura nombre, edad, sexo del paciente.
3. **Pre-test (Ensayo de Práctica):** Demo visual de las líneas objetivo vs. distractoras.
4. **Prueba Principal:** Renderizado sobre `<canvas>` HTML5 con estímulos cronometrados línea por línea.
5. **Cómputo Local (Edge):** `metrics.js` calcula las 32 variables en la RAM del navegador del cliente.
6. **Envío al Backend:** `app.js` hace un POST JSON al FastAPI con el paquete completo.
7. **Pantalla de Resultados:** Muestra el perfil predicho, porcentaje de confianza, semáforo normativo y narrativa clínica generada.
8. **Historial:** Tabla con todas las evaluaciones del psicólogo + botones de Descarga (Signed URL 60s) y Eliminación.

### 5.2 Motor de Renderizado: Canvas HTML5
- La prueba está pintada sobre `<canvas>`, no sobre elementos DOM. Esto garantiza latencia de renderizado de **~16ms** (60 FPS constantes).
- Los cronómetros son independientes por estímulo y son puramente JavaScript (no dependen de la red).
- **Resultado:** Latencia de interacción garantizada en **0 a 5ms** — el paciente no siente ningún freno.

### 5.3 Librerías del Frontend
| Librería | Uso |
|---|---|
| `@supabase/supabase-js@2` | Autenticación y consultas a la DB desde el cliente |
| `Chart.js@4.4.2` | Visualización de gráficas de resultados (barras de probabilidad, etc.) |
| `Inter` (Google Fonts) | Tipografía principal — sin serifa, alta legibilidad |
| `Playfair Display` (Google Fonts) | Tipografía de acentos/títulos decorativos |

### 5.4 Sistema de Diseño (CSS Tokens)
- **Color primario:** `#1A237E` (Azul institucional profundo)
- **Fondo:** `#F4F6F9` (Gris nube clínico, estándar HealthTech)
- **Tarjetas:** `#FFFFFF` con sombra `rgba(26,35,126,.10)` (elevación suave)
- **Semáforo normativo:** Verde (`#E8F5E9`), Amarillo (`#FFF8E1`), Rojo (`#FFEBEE`) con efecto Glassmorphism en modal
- **Modal Clínico:** `backdrop-filter: blur(12px)` + fondo semitransparente (Glassmorphism)
- **Transiciones:** `cubic-bezier(0.16, 1, 0.3, 1)` para animaciones fluidas tipo iOS

---

## 6. ⚡ ANÁLISIS DE LATENCIA (Por Qué es "Espectacular")

| Etapa | Latencia Actual | Descripción |
|---|---|---|
| Interacción en Prueba (Clic → Feedback) | **0 - 5ms** | Edge Computing puro. Sin red involucrada. |
| Envío de datos al servidor (Red Colombia → Cloud US) | **80 - 100ms** | Ping transatlántico estándar |
| Inferencia del Modelo MLP | **10 - 20ms** | Red neuronal liviana. No es un LLM. |
| **Latencia total percibida** (Fin de prueba → Resultado IA) | **~150 - 200ms** | Percibido como instantáneo (< 300ms umbral humano) |
| Generación de reporte Excel (FIFO, en background) | **2,000 - 4,000ms** | El usuario ya está en la pantalla de resultados. Totalmente invisible. |

---

## 7. 🔧 CONTROL DE VERSIONES: GitHub

- El código fuente completo del proyecto reside en un repositorio **GitHub**.
- Desde GitHub, **Vercel** lee automáticamente el directorio `frontend/` en cada `push` y redespliega la aplicación en segundos (CI/CD automático).
- El backend Python en `backend/` es gestionado manualmente para el despliegue en Hugging Face.

---

## 8. 🎨 ESTADO ESTÉTICO ACTUAL (Ingeniería UI)

### Lo que ya está bien (75% del estándar SaaS):
- ✅ Paleta de color clínica profesional con variables CSS (`--primary`, `--bg`, `--white`)
- ✅ Sistema de sombras y elevación tipo HealthTech
- ✅ Semáforo normativo con gradientes semánticos y Glassmorphism
- ✅ Tipografía `Inter` para datos (estándar de Silicon Valley)
- ✅ Animaciones suaves con `cubic-bezier` (sensación nativa/iOS)
- ✅ Sistema de botones con micro-interacciones (`hover`, `active`, `disabled`)

### Lo que falta (El 25% para nivel SaaS Premium):
- ❌ **Choque tipográfico:** `Playfair Display` (serif ornamental) en el Dashboard rompe con la estética técnica. Debe ser eliminada del interior de la plataforma y reemplazada por `Inter Bold`.
- ❌ **Layout tipo escritorio:** La plataforma carece de una barra lateral (Sidebar) de navegación persistente. Actualmente se siente como "una herramienta de una pantalla", no como un ecosistema.
- ❌ **Color primario:** `#1A237E` es pesado y denso. Puede modernizarse hacia un azul más eléctrico (`#2563EB` o `#0EA5E9`) sin perder el tono médico/institucional.
- ❌ **Sin página Home/Dashboard:** No existe una vista panorámica de estadísticas del psicólogo (total de pacientes, pruebas, tendencias).

---

> *Este baseline valida que **MecaPsi** no parte de cero. La arquitectura de grado enterprise ya existe. Lo que sigue es escalarla estéticamente, añadir telemetría de hardware y construir el CRM multi-tenant.*
