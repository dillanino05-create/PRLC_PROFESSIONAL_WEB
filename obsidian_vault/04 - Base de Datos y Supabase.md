# 🗄️ 04 - Base de Datos y Supabase

La persistencia de datos, autenticación y almacenamiento de archivos de **PLC Professional** se realiza a través de **Supabase (PostgreSQL)** en la nube.

---

## 📊 Estructura de la Tabla `evaluations`

| Columna | Tipo SQL | Descripción |
| --- | --- | --- |
| `id` | `BIGINT PRIMARY KEY` | Identificador autoincremental de la evaluación. |
| `user_id` | `UUID` | ID de Supabase Auth del psicólogo que realizó la prueba. |
| `created_at` | `TIMESTAMPTZ` | Fecha y hora exacta de registro. |
| `participant_id` | `TEXT` | Documento o código anónimo del evaluado. |
| `name` | `TEXT` | Nombre del participante (protegido por confidencialidad). |
| `age` | `INT` | Edad del participante. |
| `gender` | `TEXT` | Género reportado. |
| `education` | `TEXT` | Nivel educativo (Primaria, Secundaria, Universidad, etc.). |
| `hand` | `TEXT` | Lateralidad (Diestro, Zurdo, Ambidiestro). |
| `occupation` | `TEXT` | Ocupación o profesión. |
| `lines_data` | `JSONB` | Array con las 14 páginas, aciertos, omisiones, tiempo y `tremor_score`. |
| `metrics_json` | `JSONB` | Vector completo de métricas clínicas (`TA`, `CP`, `TRM`, `VAR`, etc.). |
| `ml_json` | `JSONB` | Predicción del modelo IA Keras: perfil asignado, confianza (%) y probabilidades. |
| `narrative` | `TEXT` | Texto descriptivo clínico generado automáticamente. |
| `excel_path` | `TEXT` | Nombre del archivo Excel generado en el servidor o storage. |
| `video_path` | `TEXT` | Ruta al video grabado de pantalla y cámara web (si se activó). |
| `status` | `TEXT` | Estado: `pending`, `processing`, `completed` o `error`. |

---

## 🔐 Políticas de Seguridad (Row Level Security - RLS)

```mermaid
flowchart TD
    Request["Petición HTTP a Supabase"]
    TokenCheck{"¿Qué credencial viaja en la cabecera?"}
    
    Request --> TokenCheck
    
    TokenCheck -->|Token de Psicólogo Estándar| RLS["Aplica Regla RLS: auth.uid() = user_id"]
    RLS --> Filtro["Solo ve y modifica sus PROPIOS pacientes"]
    
    TokenCheck -->|SUPABASE_SERVICE_KEY (Backend)| Bypass["Bypass Total de Políticas RLS"]
    Bypass --> AdminStats["SuperAdmin: Consulta todas las evaluaciones y cuentas globales"]
```

### Política SQL de Acceso para SuperAdmin en Supabase

Para permitir que las consultas del SuperAdmin funcionen tanto por backend como por cliente:

```sql
CREATE POLICY "SuperAdmin puede ver todas las evaluaciones" 
ON public.evaluations 
FOR SELECT 
TO authenticated 
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'superadmin' 
  OR auth.uid() = user_id
);
```

---

## 👥 Gestión de Roles en `auth.users`

Supabase almacena el rol dentro del campo `raw_user_meta_data`:

- **Psicólogo Estándar:** Sin metadatos o con `role: "psicólogo clínico"`.
- **SuperAdmin (Dilan):**

  ```json
  {
    "role": "superadmin"
  }
  ```

---

## 🔗 Enlaces Relacionados en la Bóveda

- [[00 - INDICE GENERAL DEL SISTEMA]]
- [[01 - Arquitectura de Despliegue]]
- [[03 - Backend y Modelos de Inteligencia Artificial]]
- [[07 - SuperAdmin Dashboard]]

