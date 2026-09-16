-- ==============================================================================
-- 🛡️ MecaPsi SaaS — Script de Endurecimiento de Seguridad (Supabase PostgreSQL)
-- Módulo: Control de Sesión Única, Auditoría Forense y Tokens Efímeros
-- Compatible con: Supabase Auth, PostgreSQL 14+, Row Level Security (RLS)
-- ==============================================================================

-- 1. TABLA DE AUDITORÍA FORENSE INMUTABLE (audit_logs)
-- Registra eventos críticos para trazabilidad y cadena de custodia pericial.
-- Por diseño legal, NUNCA se permiten operaciones de UPDATE ni DELETE a usuarios normales.
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,               -- e.g., 'LOGIN_SUCCESS', 'LOGIN_FAILED', 'UNLOCK_RESULTS', 'FOCUS_LOST_ALERT'
    ip_address TEXT,
    user_agent TEXT,
    details JSONB DEFAULT '{}'::jsonb,  -- Metadata contextual adicional (número de fallas, duración, etc.)
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices para búsqueda ágil en el panel de auditoría
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- Habilitar RLS en audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Política de Inserción: Usuarios autenticados pueden registrar sus propios eventos
CREATE POLICY "Usuarios pueden registrar sus logs de auditoría"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Política de Lectura: El usuario solo ve sus propios registros; SuperAdmin ve todos
CREATE POLICY "Lectura de logs por usuario o SuperAdmin"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
    auth.uid() = user_id 
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'superadmin'
);

-- ==============================================================================
-- 2. TABLA DE CONTROL DE SESIÓN ÚNICA Y CONCURRENCIA (active_sessions)
-- Garantiza que una cuenta básica/pro solo esté abierta en 1 navegador/dispositivo a la vez.
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.active_sessions (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    current_session_id TEXT NOT NULL,       -- UUID v4 generado por el cliente al iniciar sesión
    plan_type TEXT DEFAULT 'pro',           -- 'basico', 'pro', 'institucional'
    max_concurrent_sessions INT DEFAULT 1,  -- 1 para básico/pro, 10+ para institucional
    ip_address TEXT,
    user_agent TEXT,
    last_heartbeat TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_active_sessions_heartbeat ON public.active_sessions(last_heartbeat DESC);

-- Habilitar RLS en active_sessions
ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios gestionan su propia sesión activa"
ON public.active_sessions
FOR ALL
TO authenticated
USING (
    auth.uid() = user_id 
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'superadmin'
)
WITH CHECK (
    auth.uid() = user_id 
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'superadmin'
);

-- ==============================================================================
-- 3. TABLA DE TOKENS EFÍMEROS DE EVALUACIÓN (exam_tokens)
-- Permite al psicólogo generar enlaces de prueba de un solo uso con estado transicional.
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.exam_tokens (
    token UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    participant_id TEXT,
    test_type TEXT DEFAULT 'PLC' NOT NULL, -- 'PLC' o 'CORSI'
    status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'revoked')),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ DEFAULT (timezone('utc'::text, now()) + interval '24 hours') NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_exam_tokens_status ON public.exam_tokens(status);
CREATE INDEX IF NOT EXISTS idx_exam_tokens_created_by ON public.exam_tokens(created_by);

-- Habilitar RLS en exam_tokens
ALTER TABLE public.exam_tokens ENABLE ROW LEVEL SECURITY;

-- El evaluador creador o SuperAdmin gestiona sus tokens
CREATE POLICY "Psicólogo gestiona sus tokens de evaluación"
ON public.exam_tokens
FOR ALL
TO authenticated
USING (
    auth.uid() = created_by 
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'superadmin'
)
WITH CHECK (
    auth.uid() = created_by 
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'superadmin'
);

-- Acceso anónimo controlado para el evaluado que ingresa con token (solo lectura si no ha expirado)
CREATE POLICY "Evaluado puede verificar su token vigente"
ON public.exam_tokens
FOR SELECT
TO anon
USING (
    expires_at > timezone('utc'::text, now()) 
    AND status IN ('pending', 'in_progress')
);

-- Evaluado puede actualizar estado a in_progress mediante función segura o update acotado
CREATE POLICY "Evaluado puede iniciar su prueba"
ON public.exam_tokens
FOR UPDATE
TO anon
USING (
    expires_at > timezone('utc'::text, now()) 
    AND status = 'pending'
)
WITH CHECK (
    status = 'in_progress'
);
