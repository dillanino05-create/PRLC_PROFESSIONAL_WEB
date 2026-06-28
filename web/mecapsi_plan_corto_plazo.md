# 🚀 Ecosistema MecaPsi: Plan de Acción a Corto Plazo (MVP RedCOLSI)
> **Última actualización:** Abril 2026 | **Horizonte:** 1 mes

Este documento define la hoja de ruta técnica inmediata para transformar la aplicación "PLC Professional" en un MVP presentable en **RedCOLSI** bajo la bandera **MecaPsi**. El principio rector es: **máximo impacto, costo operativo cero.**

---

## ESTADO DE PARTIDA

Para no perder contexto, lo que ya tenemos funcionando al 100%:
- ✅ Prueba PLC completa sobre Canvas HTML5 con cronometría real
- ✅ Motor de 32 características + Modelo MLP (97% precisión) en Hugging Face / FastAPI
- ✅ Base de datos Supabase con RLS + Auth JWT
- ✅ Cola FIFO asíncrona (latencia percibida < 200ms)
- ✅ Signed URLs de 60s para descarga segura de reportes Excel
- ✅ Historial de evaluaciones por psicólogo
- ✅ Sistema de diseño CSS con semáforo normativo y Glassmorphism

---

## 🎨 FASE 0: Cirugía Estética del Dashboard (Prioridad ALTA — Impacto Visual Inmediato)

> **¿Por qué primero esto?** El 80% del juicio de un jurado de RedCOLSI o un primer cliente es visual. Si la plataforma ya tiene buena arquitectura pero se ve como "proyecto universitario", perdemos. Si se ve como startup consolidada, ganamos aunque el backend sea simple.

### 0.1 Corrección Tipográfica (Urgente)
- **Eliminar `Playfair Display`** de todos los componentes internos del Dashboard (métricas, secciones, tarjetas).
- **Reemplazar por `Inter Bold/SemiBold`** para todos los títulos y valores numéricos dentro de la plataforma.
- `Playfair Display` se conserva *únicamente* en la Landing Page de marketing exterior.
- **Resultado esperado:** El diseño pasa de "elegante pero antiguo" a "preciso y técnico" — el lenguaje visual correcto para HealthTech.

### 0.2 Implementación de Sidebar de Navegación
Añadir una barra lateral persistente que transforme la experiencia de "herramienta de una pantalla" a "ecosistema SaaS":
```
┌─────────────────────────────────────────────┐
│ 🧠 MecaPsi         [Avatar usuario]         │
├──────────┬──────────────────────────────────┤
│          │                                  │
│ 📊 Dashboard │   Área de trabajo principal  │
│ 👥 Pacientes │                              │
│ 📋 Pruebas   │   (cambia según sección)     │
│ 📁 Reportes  │                              │
│ ⚙️ Config    │                              │
│          │                                  │
└──────────┴──────────────────────────────────┘
```
- Las primeras 2-3 secciones serán funcionales para RedCOLSI; el resto pueden ser "próximamente" sin que el jurado lo note.

### 0.3 Actualización de Paleta de Color
- Migrar `--primary` de `#1A237E` (azul añil muy oscuro) a `#2563EB` (azul eléctrico moderno).
- Ajustar gradientes del header y sidebar para coherencia.
- **Resultado:** El sistema pasa visualmente de "institucional pesado" a "startup HealthTech de Silicon Valley".

### 0.4 Pantalla Home / Dashboard (KPIs del Psicólogo)
Crear una nueva vista de inicio post-login con tarjetas resumen:
- **Total de pacientes** evaluados
- **Pruebas realizadas** este mes
- **Perfil más frecuente** detectado
- **Última evaluación** (nombre + fecha + perfil)
- Gráfica de barras de distribución de perfiles en el tiempo (Chart.js)

### 0.5 Herramienta para el Diseño: Stitch MCP (Google)
- Usar el **MCP de Stitch** conectado directamente en nuestro entorno para generar pantallas de alta fidelidad de los componentes anteriores.
- El flujo será: Stitch genera el diseño visual → yo integro el HTML/CSS resultante en el proyecto.

---

## 🕹️ FASE 1: Telemetría de Hardware sin Hardware (El "Moat" para RedCOLSI)

> **Diferenciador clave:** Capturar bioseñales objetivas del comportamiento motor del paciente usando los sensores ya integrados en sus dispositivos. Sin comprar ningún hardware externo.

### 1.1 Sensorización del Ratón (JavaScript Puro)
- Implementar un listener `mousemove` que registre cada posición `(X, Y, timestamp)` durante toda la prueba.
- Cálculo de métricas derivadas:
  - **Tiempo de vacilación en el aire** (mouse quiet time antes del clic)
  - **Aceleración intermítem** (derivada de velocidad entre clics consecutivos)
  - **Velocidad balística de respuesta** (velocidad media en el último 20% del recorrido hacia el estímulo)
  - **Micro-temblores** (desviación estándar de micro-movimientos en ventanas de 50ms)

### 1.2 Sensorización Mobile / Tablet (Giroscopio)
- Implementar acceso a la API nativa del navegador `DeviceMotionEvent` y `DeviceOrientationEvent`.
- Registrar aceleración angular `(alpha, beta, gamma)` sincronizada con cada clic del paciente.
- Métricas derivadas:
  - **Índice de Temblor** durante el momento de la selección
  - **Estabilidad postural** (varianza angular durante toda la prueba)
  - **Perturbación inercial** (pico de movimiento en el instante ±50ms del clic)

### 1.3 Almacenamiento Eficiente (Data Lake Ligero)
- Los arrays de telemetría pesada (miles de coordenadas) NO van a la tabla SQL de PostgreSQL.
- Se almacenan como archivos `telemetry_{eval_id}.json` en un bucket de Supabase Storage (`/telemetry-bucket/`).
- En la tabla `evaluations` solo se guarda el **resumen estadístico** (media, varianza, pico) + el path de referencia al archivo JSON completo.

---

## 👥 FASE 2: CRM Clínico Multi-Tenant (Gestión de Pacientes)

> **Valor comercial:** Un psicólogo no solo quiere ver resultados de una prueba — quiere ver la **evolución de su paciente** a lo largo de múltiples sesiones.

### 2.1 Reestructura de Base de Datos Supabase
Nuevas tablas a crear mediante migración SQL:

```sql
-- Tabla de pacientes (independiente del usuario evaluado en la prueba)
CREATE TABLE pacientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  psicologo_id UUID REFERENCES auth.users(id),
  nombre TEXT NOT NULL,
  cedula TEXT UNIQUE,
  fecha_nacimiento DATE,
  sexo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vincular evaluaciones a pacientes
ALTER TABLE evaluations ADD COLUMN paciente_id UUID REFERENCES pacientes(id);

-- RLS: Un psicólogo solo ve sus pacientes
ALTER TABLE pacientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Solo dueño" ON pacientes
  USING (psicologo_id = auth.uid());
```

### 2.2 Panel de Gestión de Pacientes
- **Buscador** por nombre o cédula.
- **Tarjeta de Paciente:** Nombre, edad, sexo, fecha de registro, número de pruebas realizadas.
- **Vista Histórica (Longitudinal):** Línea de tiempo de todas las evaluaciones del paciente con perfil detectado en cada una.

### 2.3 Visualización de Tendencias (Chart.js)
- Gráfica lineal de evolución: eje X = fecha de prueba, eje Y = métricas clave (TA, O, TRM).
- Indicador visual de si el desempeño **mejora** 📈, **se mantiene** ➡️ o **empeora** 📉 entre sesiones.

---

## 🧪 FASE 3: Integración del Análisis Multi-Modal (Para Demo en RedCOLSI)

> **Narrativa para el Jurado:** *"Nuestra plataforma no solo califica la prueba — expone el rastro motor del paciente desde 4 ángulos simultáneos."*

Para la presentación en RedCOLSI, mostrar visualmente (aunque sea como demo con datos de ejemplo) cómo los 4 módulos de análisis trabajan en paralelo:

| Canal | Sensor | Métrica Principal |
|---|---|---|
| 1. MLP Cognitivo | Cálculo matemático | Perfil normativo (P0-P7) |
| 2. Ratón / Touch | `mousemove` JS | Velocidad balística, temblor |
| 3. Giroscopio | `DeviceMotionEvent` | Índice de temblor postural |
| 4. Tiempo de Vacilación | Cronómetro por clic | Latencia de decisión |

Cada canal emite su "opinión" de forma independiente. La pantalla de resultados los muestra en paralelo como un "panel de instrumentos clínicos".

---

## 📋 FASE 4: Preparación para RedCOLSI (Presentación y Demo)

### 4.1 Material de Validación Técnica para el Jurado
Preparar una página "Acerca del Modelo" dentro de la plataforma con:
- Métricas de rendimiento del MLP (Train/Val Accuracy, curvas)
- Descripción del dataset (14,000 muestras sintéticas, 32 features)
- Explicación de las 32 variables con sus unidades

### 4.2 Checklist de Demo en Vivo (Para no fallar en presentación)
- [ ] Tener cuenta de psicólogo demo creada y con sesión activa
- [ ] Tener 3-5 evaluaciones previas cargadas para mostrar historial
- [ ] Probar el flujo completo (Prueba → Resultado → Excel) en el dispositivo de presentación
- [ ] Tener el backend de Hugging Face en estado "warm" (no suspendido) antes de la demo
- [ ] Backup de capturas de pantalla en caso de que falle la conexión a internet

---

## 🔭 FASE 5 (Horizonte Futuro): La IA de Ensamble

Una vez que el ciclo de recolección esté operativo con datos reales:
- **Mini-red de ratón:** MLP especialista en biomarcadores de movimiento motor fino.
- **Mini-red de giroscopio:** MLP especialista en temblor e inestabilidad postural.
- **Mini-red cognitiva:** El MLP actual (P0-P7).
- **Meta-Modelo de Ensamble:** Fusiona las 3 opiniones con pesos aprendidos y emite un diagnóstico final integrado.

---

## 💸 PROYECCIÓN DE COSTOS (MVP a 0 Pesos)

| Servicio | Costo Actual | Límite Free Tier |
|---|---|---|
| Vercel (Frontend) | $0 | 100GB bandwidth/mes |
| Supabase (DB + Auth) | $0 | 500MB DB, 1GB Storage |
| Hugging Face (IA) | $0 | CPU Spaces gratuitos |
| GitHub (Código) | $0 | Repos ilimitados |
| **TOTAL MENSUAL** | **$0** | Escalable hasta ~1,000 usuarios activos |

---

> *Este plan transita de un "script de prueba" a un MVP de SaaS HealthTech completo: con diseño premium, telemetría de hardware nativa, CRM clínico multi-tenant y arquitectura preparada para escalar hacia el ecosistema MecaPsi completo.*
