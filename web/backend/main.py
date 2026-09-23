import os
import gc
import json
import base64
import math
import time
import asyncio
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional
from contextlib import asynccontextmanager

import matplotlib.pyplot as plt

from fastapi import FastAPI, HTTPException, Header, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response

from supabase import create_client, Client, ClientOptions
import httpx

from .models import PredictRequest, SaveRequest
from .predictor import predictor, corsi_predictor
from .excel_export import save_excel, EXPORTS_DIR, sanitize_tag_part, generate_session_tag

# ── Paths ──────────────────────────────────────────────────────────────────────
WEB_DIR      = Path(__file__).parent.parent
FRONTEND_DIR = WEB_DIR / 'frontend'

# ── Helpers de Identidad y Cadena de Custodia Forense ──────────────────────────
def compute_session_tag(row: dict) -> str:
    """Recupera o calcula el tag forense estandarizado de una evaluación (retrocompatible)."""
    metrics = row.get("metrics_json") or {}
    if metrics.get("session_tag"):
        return metrics["session_tag"]
    
    excel_path = row.get("excel_path") or ""
    ts = None
    if excel_path:
        import re
        m = re.search(r'(\d{8}_\d{6})', excel_path)
        if m:
            ts = m.group(1)
            
    if not ts:
        cat = parse_iso_datetime(row.get("created_at"))
        ts = cat.strftime('%Y%m%d_%H%M%S') if cat else datetime.utcnow().strftime('%Y%m%d_%H%M%S')
        
    test_type = metrics.get("test_type") or "PLC"
    session_id = row.get("id", "0")
    patient_id = row.get("participant_id") or row.get("participant_name") or "PACIENTE"
    return generate_session_tag(test_type, session_id, patient_id, ts)

# ── Cola Global FIFO ───────────────────────────────────────────────────────────
task_queue = asyncio.Queue()

async def sequential_worker():
    """Worker controlado para generar reportes secuenciales sin ahogar la CPU."""
    while True:
        try:
            # Polling eficiente: duerme la corrutina hasta que llega un reporte
            task = await task_queue.get()
            if len(task) == 12:
                eval_id, token, uid, part, lines, clicks, metrics, ml_pred, narrative, test_type, session_tag, timestamp_str = task
            else:
                eval_id, token, uid, part, lines, clicks, metrics, ml_pred, narrative = task[:9]
                test_type = "PLC"
                session_tag = None
                timestamp_str = None
            
            print(f"[WORKER] Iniciando procesamiento orden FIFO de eval_id: {eval_id} (tag: {session_tag or 'N/A'})")
            
            # Delega el cálculo asíncronamente para no bloquear event-loop si hay peticiones
            await asyncio.to_thread(
                process_excel_bg, token, eval_id, uid, part, lines, clicks, metrics, ml_pred, narrative, test_type, session_tag, timestamp_str
            )
            
            # Recolección obligatoria de basura y liberación explícita VRAM/RAM
            plt.close('all')
            gc.collect()
            print(f"[WORKER] RAM purgada exitosamente tras eval_id: {eval_id}")
            
            task_queue.task_done()
        except asyncio.CancelledError:
            print("[WORKER] Apagando worker de manera segura.")
            break
        except Exception as e:
            print(f"[WORKER] Excepción catastrófica en el proceso en cola: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Encender worker en 2do plano al arrancar la app
    worker_task = asyncio.create_task(sequential_worker())
    yield
    # Apagar worker en shutdown
    worker_task.cancel()

app = FastAPI(title='PLC Professional Web', version='3.3', lifespan=lifespan)

def parse_iso_datetime(dt_str: Optional[str]) -> Optional[datetime]:
    """Parser ISO ultra-robusto compatible con Python 3.8-3.14 e inmune a variaciones de milisegundos."""
    if not dt_str:
        return None
    try:
        clean = dt_str[:19]
        return datetime.strptime(clean, '%Y-%m-%dT%H:%M:%S')
    except Exception:
        try:
            s = dt_str.replace('Z', '+00:00')
            return datetime.fromisoformat(s)
        except Exception:
            return None

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Módulo de Seguridad: Rate Limiting en Memoria (Sliding Window) ────────────
class SimpleRateLimiter:
    """Rate limiter en memoria de ventana deslizante sin dependencias externas (Redis/Memcached)."""
    def __init__(self):
        self.records: dict[str, list[float]] = {}
        self._lock = asyncio.Lock()

    async def check(self, key: str, max_calls: int, window_seconds: float = 60.0) -> bool:
        now = time.time()
        async with self._lock:
            timestamps = self.records.setdefault(key, [])
            # Purgar marcas que salieron de la ventana temporal
            self.records[key] = [t for t in timestamps if now - t < window_seconds]
            if len(self.records[key]) >= max_calls:
                return False
            self.records[key].append(now)
            return True

limiter = SimpleRateLimiter()

# ── Middleware de Cabeceras de Seguridad (OWASP Best Practices) ───────────────
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# ── Supabase Setup ─────────────────────────────────────────────────────────────
SUPABASE_URL         = os.getenv("SUPABASE_URL", "https://lfyaiwbtfgoiczyyzlwh.supabase.co")
SUPABASE_KEY         = os.getenv("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmeWFpd2J0ZmdvaWN6eXl6bHdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNjc1MTEsImV4cCI6MjA5MDY0MzUxMX0.ZfVceXuYWQKEZimgRLt9kGkSGpq8FO7kRgKbL-Ta-3M")
# Service Role Key: bypass de RLS para consultas de SuperAdmin. Configura en HF Spaces → Settings → Secrets
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

async def get_supabase(request: Request, authorization: str = Header(None)) -> dict:
    client_ip = request.client.host if request.client else "unknown"
    if not authorization or not authorization.startswith("Bearer "):
        await asyncio.sleep(1.0)  # Tarpit delay contra bots de fuerza bruta
        raise HTTPException(status_code=401, detail="Falta autorización/Ingresa de nuevo")
    
    token = authorization.split(" ")[1]
    
    # Cliente configurado para actuar en nombre del psicólogo logueado (Respetando RLS)
    opts = ClientOptions(
        headers={'Authorization': f'Bearer {token}'},
        httpx_client=httpx.Client(http2=False)
    )
    sb = create_client(SUPABASE_URL, SUPABASE_KEY, options=opts)
    
    # Verificación del usuario contra Supabase Auth
    try:
        res = sb.auth.get_user(token)
    except Exception:
        await asyncio.sleep(1.2)  # Tarpit delay
        raise HTTPException(status_code=401, detail="Usuario inválido o sesión expirada")

    if not res or not res.user:
        await asyncio.sleep(1.2)  # Tarpit delay
        raise HTTPException(status_code=401, detail="Usuario inválido")
         
    return {"client": sb, "user_id": res.user.id, "token": token, "ip": client_ip, "user": res.user, "email": (res.user.email or "").strip().lower()}


async def verify_superadmin(request: Request, authorization: str = Header(None)) -> dict:
    """Dependencia FastAPI: verifica que el JWT pertenezca a un usuario con role='superadmin' en user_metadata."""
    client_ip = request.client.host if request.client else "unknown"
    if not authorization or not authorization.startswith("Bearer "):
        await asyncio.sleep(1.2)  # Tarpit
        raise HTTPException(status_code=401, detail="Falta autorización")
    token = authorization.split(" ")[1]
    opts = ClientOptions(
        headers={'Authorization': f'Bearer {token}'},
        httpx_client=httpx.Client(http2=False)
    )
    sb = create_client(SUPABASE_URL, SUPABASE_KEY, options=opts)
    try:
        res = sb.auth.get_user(token)
    except Exception:
        await asyncio.sleep(1.2)
        raise HTTPException(status_code=401, detail="Usuario inválido o sesión expirada")

    if not res or not res.user:
        await asyncio.sleep(1.2)
        raise HTTPException(status_code=401, detail="Usuario inválido o sesión expirada")

    user_email = (res.user.email or "").strip().lower()
    app_meta = getattr(res.user, 'app_metadata', {}) or {}
    user_meta = res.user.user_metadata or {}

    # Verificación blindada: rol en app_metadata (protegido por Supabase) O correo del SuperAdmin oficial
    # Previene que un usuario ordinario escale privilegios alterando sus propios user_metadata vía cliente
    is_admin = (
        app_meta.get('role') == 'superadmin' 
        or user_email == 'dillanino05@gmail.com'
        or (user_meta.get('role') == 'superadmin' and user_email == 'dillanino05@gmail.com')
    )
    if not is_admin:
        await asyncio.sleep(1.5)  # Tarpit delay ante intentos no autorizados de escalada de privilegios
        raise HTTPException(status_code=403, detail="Acceso restringido: Solo SuperAdmin puede acceder a este recurso")
    return {"user_id": res.user.id, "token": token, "ip": client_ip}


# ── Archivos Estáticos ─────────────────────────────────────────────────────────
app.mount('/static', StaticFiles(directory=str(FRONTEND_DIR)), name='static')

@app.get('/')
def root():
    return FileResponse(str(FRONTEND_DIR / 'index.html'))

@app.get('/api/status')
def status():
    return {'model_available': predictor.available, 'version': '3.3'}

@app.get('/api/session/verify')
async def verify_session(user_id: str, session_id: str, auth_ctx: dict = Depends(get_supabase)):
    """Verifica si la sesión del cliente sigue siendo la sesión activa registrada (Single Active Session)."""
    if auth_ctx["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="No autorizado para verificar esta sesión")
    sb = auth_ctx["client"]
    try:
        res = sb.table("active_sessions").select("current_session_id").eq("user_id", user_id).maybe_single().execute()
        if res and res.data:
            is_valid = (res.data.get("current_session_id") == session_id)
            return {"valid": is_valid}
        return {"valid": True}
    except Exception:
        return {"valid": True}

@app.get('/api/exam-token/verify/{token}')
async def verify_exam_token(token: str):
    """Verifica la validez y estado de un token efímero de evaluación de un solo uso."""
    opts = ClientOptions(httpx_client=httpx.Client(http2=False))
    sb = create_client(SUPABASE_URL, SUPABASE_KEY, options=opts)
    try:
        res = sb.table("exam_tokens").select("token, status, test_type, expires_at").eq("token", token).maybe_single().execute()
        if not res or not res.data:
            raise HTTPException(status_code=404, detail="Token de evaluación inválido o inexistente")
        row = res.data
        if row.get("status") in ("completed", "revoked"):
            return {"valid": False, "reason": f"El token ya ha sido utilizado o revocado ({row.get('status')})"}
        return {"valid": True, "token": row.get("token"), "test_type": row.get("test_type")}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error validando token: {str(e)}")


@app.post('/api/predict')
async def predict(req: PredictRequest, request: Request):
    client_ip = request.client.host if request.client else "127.0.0.1"
    if not await limiter.check(f"predict:{client_ip}", max_calls=25, window_seconds=60.0):
        raise HTTPException(status_code=429, detail="Límite de predicciones excedido (Rate limit: 25/min). Por favor espere un momento.")
    req_dict = req.model_dump()
    if req_dict.get("test_type") == "CORSI":
        return corsi_predictor.predict(req_dict)
    return predictor.predict(req_dict)

def process_excel_bg(token: str, eval_id: int, uid: str, part, lines, clicks, metrics, ml_pred, narrative,
                     test_type: str = "PLC", session_tag: Optional[str] = None, timestamp_str: Optional[str] = None):
    opts = ClientOptions(
        headers={'Authorization': f'Bearer {token}'},
        httpx_client=httpx.Client(http2=False, timeout=httpx.Timeout(60.0, connect=15.0))
    )
    sb = create_client(SUPABASE_URL, SUPABASE_KEY, options=opts)
    
    try:
        try:
            sb.table("evaluations").update({"status": "processing"}).eq("id", eval_id).execute()
        except Exception as ue:
            print(f"⚠️ Error status processing: {ue}")
        
        excel_path = save_excel(part, lines, clicks, metrics, ml_pred, narrative,
                                test_type=test_type, session_id=eval_id, timestamp_str=timestamp_str, session_tag=session_tag)
        filename = os.path.basename(excel_path)
        
        with open(excel_path, "rb") as f:
            file_bytes = f.read()
            
        uploaded = False
        last_err = None
        for attempt in range(3):
            try:
                sb.storage.from_("exports").upload(
                    path=filename, 
                    file=file_bytes, 
                    file_options={"content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "upsert": "true"}
                )
                uploaded = True
                break
            except Exception as up_e:
                last_err = up_e
                print(f"⚠️ Intento {attempt + 1}/3 subida Excel falló: {up_e}")
                time.sleep(1.0)
                
        if uploaded:
            try: os.remove(excel_path)
            except Exception: pass
            
        sb.table("evaluations").update({"status": "completed", "excel_path": filename}).eq("id", eval_id).execute()
        
    except Exception as e:
        print(f"Error bg_excel: {e}")
        try: sb.table("evaluations").update({"status": "completed"}).eq("id", eval_id).execute()
        except Exception: pass

@app.post('/api/save')
async def save(req: SaveRequest, authorization: str = Header(None), auth_ctx: dict = Depends(get_supabase)):
    sb = auth_ctx["client"]
    uid = auth_ctx["user_id"]
    client_ip = auth_ctx.get("ip", "unknown")
    token = authorization.split(" ")[1] if authorization else ""

    # Rate limiting: Máximo 12 guardados por minuto por usuario
    if not await limiter.check(f"save:{uid}", max_calls=12, window_seconds=60.0):
        raise HTTPException(status_code=429, detail="Límite de guardado excedido (Rate limit: 12/min). Por favor espere un momento.")

    try:
        part      = req.participant.model_dump()
        metrics   = req.metrics.model_dump()
        lines     = [l.model_dump() for l in req.lines_data]
        clicks    = [c.model_dump() for c in req.click_log]
        ml_pred   = req.ml_prediction
        narrative = req.narrative

        test_type = getattr(req, "test_type", None) or metrics.get("test_type") or "PLC"
        clean_test = sanitize_tag_part(test_type, "PLC")
        timestamp_str = req.session_uid or metrics.get("session_uid") or datetime.now().strftime('%Y%m%d_%H%M%S')

        # Inserción ruda de base de datos
        row_data = {
            "user_id": uid,
            "status": "pending",
            "participant_id": part["id"],
            "participant_name": part["name"],
            "age": part["age"],
            "gender": part["gender"],
            "education": part["education"],
            "hand": part["hand"],
            "occupation": part.get("occupation", ""),
            "metrics_json": metrics,
            "ml_json": ml_pred,
            "lines_json": lines,
            "clicks_json": clicks,
            "narrative": narrative,
            "excel_path": ""
        }
        res = sb.table("evaluations").insert(row_data).execute()
        eval_id = res.data[0]["id"]

        # Registrar log de auditoría médica forense
        try:
            sb.table("audit_logs").insert({
                "user_id": uid,
                "action": "EVALUATION_SAVED",
                "ip_address": client_ip,
                "details": {
                    "eval_id": eval_id,
                    "test_type": clean_test,
                    "participant_id": part["id"],
                    "is_flagged": metrics.get("integrity_audit", {}).get("is_flagged", False)
                }
            }).execute()
        except Exception:
            pass

        # Generar Tag Forense Unificado: {TEST}_{SESSION_ID}_{PATIENT_CLEAN_ID}_{YYYYMMDD_HHMMSS}
        session_tag = generate_session_tag(clean_test, eval_id, part["id"], timestamp_str)
        video_filename = f"{session_tag}.mp4"
        excel_filename = f"{session_tag}.xlsx"

        # Propagar metadatos unificados a la base de datos
        metrics["test_type"] = clean_test
        metrics["session_tag"] = session_tag
        metrics["session_uid"] = timestamp_str
        metrics["video_path"] = video_filename

        try:
            sb.table("evaluations").update({
                "excel_path": excel_filename,
                "metrics_json": metrics
            }).eq("id", eval_id).execute()
        except Exception as up_err:
            print(f"⚠️ Error actualizando metadatos de sesión {eval_id}: {up_err}")

        # Inyección a la Cola Restringida FIFO local en lugar de disparar threads irrestrictos
        task_queue.put_nowait((eval_id, token, uid, part, lines, clicks, metrics, ml_pred, narrative, clean_test, session_tag, timestamp_str))

        return {
            'id': eval_id,
            'status': 'pending',
            'session_tag': session_tag,
            'test_type': clean_test,
            'video_filename': video_filename,
            'excel_filename': excel_filename
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get('/api/export/{eval_id}')
async def export(eval_id: int, auth_ctx: dict = Depends(get_supabase)):
    sb = auth_ctx["client"]
    uid = auth_ctx["user_id"]
    # Defensa IDOR: Registro vinculado al usuario autenticado
    res = sb.table("evaluations").select("*").eq("id", eval_id).eq("user_id", uid).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Archivo no encontrado en base de datos")
    
    row = res.data[0]
    filename = row.get("excel_path")
    st = row.get("status")

    # 1. Si existe en Storage y completado, intentar enlace firmado
    if filename and st == "completed":
        try:
            signed_res = sb.storage.from_("exports").create_signed_url(filename, 120)
            secure_url = signed_res.get("signedURL") or signed_res.get("signedUrl")
            if secure_url:
                return {"url": secure_url}
        except Exception as pe:
            print(f"⚠️ create_signed_url falló para {filename}: {pe}. Activando compilación on-the-fly.")

    # 2. FALLBACK INMUNE: Generar Excel en caliente en el servidor y servir como FileResponse
    try:
        part = {
            'id': row.get('participant_id', 'P01'),
            'name': row.get('participant_name', 'Paciente'),
            'age': row.get('age', 25),
            'gender': row.get('gender', 'M'),
            'education': row.get('education', 'Universitario'),
            'hand': row.get('hand', 'Derecha'),
            'occupation': row.get('occupation', '')
        }
        lines = row.get('lines_json') or []
        clicks = row.get('clicks_json') or []
        metrics = row.get('metrics_json') or {}
        ml_pred = row.get('ml_json')
        narrative = row.get('narrative', '')

        session_tag = compute_session_tag(row)
        test_type = metrics.get("test_type", "PLC")
        excel_path = save_excel(part, lines, clicks, metrics, ml_pred, narrative,
                                test_type=test_type, session_id=eval_id, session_tag=session_tag)
        download_name = f"{session_tag}.xlsx"
        
        return FileResponse(
            path=excel_path,
            filename=download_name,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
    except Exception as fe:
        raise HTTPException(status_code=500, detail=f"No se pudo compilar el Excel de este participante: {str(fe)}")

@app.get('/api/history')
def history(auth_ctx: dict = Depends(get_supabase)):
    sb = auth_ctx["client"]
    user = auth_ctx.get("user")
    user_email = auth_ctx.get("email", "")
    user_meta = getattr(user, "user_metadata", {}) or {}
    app_meta = getattr(user, "app_metadata", {}) or {}
    is_superadmin = (
        user_meta.get("role") == "superadmin" or
        app_meta.get("role") == "superadmin" or
        user_email == "dillanino05@gmail.com"
    )
    try:
        # Extrae de forma segura el historial vinculado. Si es SuperAdmin, permite visibilidad global
        data = []
        if is_superadmin and SUPABASE_SERVICE_KEY:
            try:
                admin_opts = ClientOptions(headers={"apikey": SUPABASE_SERVICE_KEY, "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}"})
                sb_admin = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY, options=admin_opts)
                res = sb_admin.table("evaluations").select(
                    "id, created_at, participant_id, participant_name, age, metrics_json, status, excel_path"
                ).order("id", desc=True).execute()
                data = res.data or []
            except Exception as admin_err:
                print(f"[HISTORY-SUPERADMIN-WARN] {admin_err}")
        
        if not data:
            res = sb.table("evaluations").select(
                "id, created_at, participant_id, participant_name, age, metrics_json, status, excel_path"
            ).order("id", desc=True).execute()
            data = res.data or []
        
        result = []
        now_dt = datetime.utcnow()
        for r in data:
            m = r.get("metrics_json") or {}
            vpath = m.get("video_path", "")
            video_days_left = None
            is_expired = bool(m.get("video_expired", False))
            
            created_at_str = r.get('created_at')
            cat = parse_iso_datetime(created_at_str)
            if cat:
                diff_sec = (now_dt - cat).total_seconds()
                days_diff = diff_sec / 86400.0
                # Política de 30 días: Día 1 comienza en la fecha de creación (0 días transcurridos -> 30 días restantes)
                video_days_left = max(0, int(math.ceil(30.0 - days_diff)))
                if days_diff >= 30.0:
                    is_expired = True
                    video_days_left = 0
            else:
                video_days_left = 30 if not is_expired else 0

            test_type = m.get('test_type', 'PLC')
            session_tag = m.get('session_tag') or compute_session_tag(r)
            corsi_mode = m.get('corsi_mode') or m.get('mode') or m.get('testMode')
            is_dual = bool(
                m.get('dual') or 
                str(corsi_mode).lower() == 'dual' or 
                (m.get('direct_span') is not None and m.get('reverse_span') is not None)
            )
            if is_dual:
                corsi_mode = 'dual'
            corsi_span = m.get('corsi_span')
            composite_score = m.get('composite_score')
            accuracy_rate = m.get('accuracy_rate') or m.get('accuracy_pct')

            result.append({
                'id': r['id'],
                'created_at': r['created_at'],
                'participant_id': r['participant_id'],
                'participant_name': r['participant_name'],
                'age': r['age'],
                'status': r.get('status', 'completed'),
                'test_type': test_type,
                'session_tag': session_tag,
                'corsi_mode': corsi_mode,
                'dual': is_dual,
                'direct_span': m.get('direct_span'),
                'reverse_span': m.get('reverse_span'),
                'direct_block_product': m.get('direct_block_product'),
                'reverse_block_product': m.get('reverse_block_product'),
                'corsi_span': corsi_span,
                'composite_score': composite_score,
                'accuracy_rate': accuracy_rate,
                'CP': round(m.get('CP', 0), 1) if 'CP' in m else 0,
                'TA': m.get('TA', 0),
                'video_path': vpath if (not is_expired and video_days_left > 0) else '',
                'video_days_left': video_days_left,
                'video_expired': is_expired
            })
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get('/api/video/{eval_id}')
async def get_video(eval_id: int, download: bool = False, auth_ctx: dict = Depends(get_supabase)):
    sb = auth_ctx["client"]
    uid = auth_ctx["user_id"]
    user = auth_ctx.get("user")
    user_email = auth_ctx.get("email", "")
    user_meta = getattr(user, "user_metadata", {}) or {}
    app_meta = getattr(user, "app_metadata", {}) or {}
    is_superadmin = (
        user_email == "dillanino05@gmail.com" 
        or user_meta.get("role") == "superadmin" 
        or app_meta.get("role") == "superadmin"
    )

    # Defensa IDOR: Los psicólogos estándar solo ven sus evaluaciones; SuperAdmin tiene visibilidad global
    query = sb.table("evaluations").select("id, metrics_json, created_at, participant_name, participant_id, excel_path, lines_json, clicks_json").eq("id", eval_id)
    if not is_superadmin:
        query = query.eq("user_id", uid)
    res = query.execute()

    if not res.data:
        raise HTTPException(status_code=404, detail="Evaluación no encontrada")
    
    row = res.data[0]
    metrics = row.get("metrics_json") or {}
    video_path = metrics.get("video_path")
    if not video_path or metrics.get("video_expired", False):
        raise HTTPException(status_code=404, detail="Esta evaluación no cuenta con una grabación de video activa o ya ha expirado.")

    # ── Política de Retención: Verificar si han pasado más de 30 días ────────
    try:
        created_at_str = row.get("created_at")
        cat = parse_iso_datetime(created_at_str)
        if cat:
            diff_sec = (datetime.utcnow() - cat).total_seconds()
            if diff_sec >= (30 * 86400):
                # Purgar archivo en Supabase Storage para liberar cuota de espacio
                try:
                    sb.storage.from_("exports").remove([video_path])
                    print(f"[AUTO-PURGE] Video {video_path} eliminado de Storage (>30 días)")
                except Exception as pe:
                    print(f"[AUTO-PURGE] Error al remover video: {pe}")
                
                # Marcar como expirado en la base de datos
                metrics["video_expired"] = True
                metrics["video_path"] = ""
                try:
                    sb.table("evaluations").update({"metrics_json": metrics}).eq("id", eval_id).execute()
                except Exception:
                    pass
                
                raise HTTPException(
                    status_code=410, 
                    detail="La grabación ha superado los 30 días de retención reglamentaria (iniciados desde su fecha de creación) y fue purgada para optimizar el almacenamiento."
                )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error verificando retención de video: {e}")
        
    session_tag = compute_session_tag(row)
    download_filename = f"{session_tag}.mp4"

    try:
        # Enlace firmado válido por 10 minutos (600s) para reproducir o descargar
        signed_res = None
        try:
            signed_res = sb.storage.from_("exports").create_signed_url(
                video_path, 600, options={"download": download_filename}
            )
        except Exception:
            signed_res = sb.storage.from_("exports").create_signed_url(video_path, 600)

        secure_url = signed_res.get("signedURL") or signed_res.get("signedUrl")
        
        # Generar download_url con parámetro de descarga forzada en formato MP4
        download_url = secure_url
        if secure_url and "download=" not in secure_url:
            sep = "&" if "?" in secure_url else "?"
            download_url = f"{secure_url}{sep}download={download_filename}"
        lines_val = row.get("lines_json")
        if isinstance(lines_val, str):
            try:
                import json
                lines_val = json.loads(lines_val)
            except Exception:
                lines_val = []
        if not isinstance(lines_val, list):
            lines_val = []

        clicks_val = row.get("clicks_json")
        if isinstance(clicks_val, str):
            try:
                import json
                clicks_val = json.loads(clicks_val)
            except Exception:
                clicks_val = []
        if not isinstance(clicks_val, list):
            clicks_val = []

        test_type = metrics.get("test_type") or ("CORSI" if "CORSI" in session_tag.upper() else "PLC")
        p_name = row.get("participant_name") or metrics.get("participant_name") or "Evaluado"
        p_id = row.get("participant_id") or metrics.get("participant_id") or "N/A"
        cat_str = row.get("created_at") or ""
        test_label = "Test de Bloques de Corsi (CBT)" if test_type == "CORSI" else "Test d2 de Atención"

        return {
            "url": secure_url,
            "download_url": download_url,
            "filename": download_filename,
            "metrics": metrics,
            "lines_data": lines_val,
            "clicks_data": clicks_val,
            "participant_name": p_name,
            "participant_id": p_id,
            "created_at": cat_str,
            "test_type": test_type,
            "participant": {
                "name": p_name,
                "doc_id": p_id,
                "test_type": test_label,
                "created_at": cat_str
            },
            "session_tag": session_tag
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"No se pudo firmar el archivo de video: {str(e)}")

def transcode_webm_to_mp4(webm_bytes: bytes) -> bytes:
    """Convierte bytes de video WebM a formato MP4 compatible con todos los reproductores."""
    import tempfile, subprocess, os, shutil
    with tempfile.NamedTemporaryFile(suffix='.webm', delete=False) as in_f:
        in_f.write(webm_bytes)
        in_path = in_f.name
    out_path = in_path.replace('.webm', '.mp4')
    try:
        # 1. Intentar con ffmpeg si está en el sistema (rápido y nativo)
        ffmpeg_bin = shutil.which("ffmpeg")
        if ffmpeg_bin:
            cmd = [
                ffmpeg_bin, "-y", "-i", in_path,
                "-c:v", "libx264", "-pix_fmt", "yuv420p",
                "-preset", "veryfast", "-crf", "24",
                "-an", out_path
            ]
            res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            if res.returncode == 0 and os.path.exists(out_path) and os.path.getsize(out_path) > 0:
                with open(out_path, "rb") as f:
                    return f.read()

        # 2. Fallback con OpenCV (cv2)
        try:
            import cv2
            cap = cv2.VideoCapture(in_path)
            if cap.isOpened():
                fps = cap.get(cv2.CAP_PROP_FPS) or 15.0
                w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                fourcc = cv2.VideoWriter_fourcc(*'mp4v')
                out = cv2.VideoWriter(out_path, fourcc, fps, (w, h))
                while True:
                    ret, frame = cap.read()
                    if not ret:
                        break
                    out.write(frame)
                cap.release()
                out.release()
                if os.path.exists(out_path) and os.path.getsize(out_path) > 0:
                    with open(out_path, "rb") as f:
                        return f.read()
        except Exception as cv_err:
            print(f"[TRANSCODE-CV2-ERR] {cv_err}")

        return webm_bytes
    finally:
        for p in (in_path, out_path):
            try:
                if os.path.exists(p):
                    os.remove(p)
            except Exception:
                pass

@app.get('/api/video/{eval_id}/stream')
async def stream_video(eval_id: int, auth_ctx: dict = Depends(get_supabase)):
    sb = auth_ctx["client"]
    uid = auth_ctx["user_id"]
    user = auth_ctx.get("user")
    user_email = auth_ctx.get("email", "")
    user_meta = getattr(user, "user_metadata", {}) or {}
    app_meta = getattr(user, "app_metadata", {}) or {}
    is_superadmin = (
        user_email == "dillanino05@gmail.com" 
        or user_meta.get("role") == "superadmin" 
        or app_meta.get("role") == "superadmin"
    )

    query = sb.table("evaluations").select("id, metrics_json, created_at, participant_name, participant_id, excel_path").eq("id", eval_id)
    if not is_superadmin:
        query = query.eq("user_id", uid)
    res = query.execute()

    if not res.data:
        raise HTTPException(status_code=404, detail="Evaluación no encontrada")
    
    row = res.data[0]
    metrics = row.get("metrics_json") or {}
    video_path = metrics.get("video_path")
    if not video_path or metrics.get("video_expired", False):
        raise HTTPException(status_code=404, detail="No hay video disponible para esta evaluación.")

    session_tag = compute_session_tag(row)
    filename = f"{session_tag}.mp4"

    try:
        # Descargar archivo original desde Storage
        file_bytes = sb.storage.from_("exports").download(video_path)

        # Si el archivo original en Storage es .webm, transcodificar a MP4 real
        if video_path.lower().endswith(".webm"):
            mp4_filename = video_path.rsplit(".", 1)[0] + ".mp4"
            cached_mp4 = False
            try:
                cached_bytes = sb.storage.from_("exports").download(mp4_filename)
                if cached_bytes and len(cached_bytes) > 0:
                    file_bytes = cached_bytes
                    cached_mp4 = True
            except Exception:
                cached_mp4 = False

            if not cached_mp4:
                print(f"[TRANSCODE] Convirtiendo video existente {video_path} a MP4...")
                transcoded = transcode_webm_to_mp4(file_bytes)
                if transcoded and len(transcoded) > 0:
                    file_bytes = transcoded
                    # Guardar el MP4 en Storage para que las siguientes descargas sean instantáneas
                    try:
                        sb.storage.from_("exports").upload(
                            mp4_filename,
                            file_bytes,
                            file_options={"content-type": "video/mp4", "upsert": "true"}
                        )
                        metrics["video_path"] = mp4_filename
                        sb.table("evaluations").update({"metrics_json": metrics}).eq("id", eval_id).execute()
                        print(f"[TRANSCODE-SAVED] Guardado {mp4_filename} en Storage y DB.")
                    except Exception as up_err:
                        print(f"[TRANSCODE-UPLOAD-WARN] {up_err}")

        return Response(
            content=file_bytes,
            media_type="video/mp4",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Access-Control-Expose-Headers": "Content-Disposition"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al descargar stream de video: {str(e)}")

@app.delete('/api/history/{eval_id}')
def delete_eval(eval_id: int, auth_ctx: dict = Depends(get_supabase)):
    sb = auth_ctx["client"]
    
    # 1. Recuperar paths y borrar archivos en Supabase Storage
    res = sb.table("evaluations").select("excel_path, metrics_json").eq("id", eval_id).execute()
    files_to_remove = []
    if res.data:
        if res.data[0].get("excel_path"):
            files_to_remove.append(res.data[0]["excel_path"])
        metrics = res.data[0].get("metrics_json") or {}
        if metrics.get("video_path"):
            files_to_remove.append(metrics["video_path"])
            
    if files_to_remove:
        try:
            sb.storage.from_("exports").remove(files_to_remove)
        except Exception as e:
            print(f"Error borrando archivos en storage: {e}")
            
    # 2. Borrar del registro en base de datos
    sb.table("evaluations").delete().eq("id", eval_id).execute()
    return {'ok': True}


# ════════════════════════════════════════════════════════════════════════════════
#  SUPERADMIN — Dashboard Global (bypass RLS usando Service Role Key)
# ════════════════════════════════════════════════════════════════════════════════
def parse_jwt_role(token_str: str) -> str:
    try:
        parts = token_str.strip().split(".")
        if len(parts) >= 2:
            pad = 4 - len(parts[1]) % 4
            data = json.loads(base64.urlsafe_b64decode(parts[1] + ("=" * pad)))
            return data.get("role", "desconocido")
    except Exception:
        pass
    return "desconocido"

@app.get('/api/admin/stats')
async def admin_stats(_admin: dict = Depends(verify_superadmin)):
    """Estadísticas globales de la plataforma para el SuperAdmin.
    Verifica la clave de servicio y consulta usuarios y evaluaciones mediante múltiples vías.
    """
    key_role = parse_jwt_role(SUPABASE_SERVICE_KEY)
    service_key_ok = bool(SUPABASE_SERVICE_KEY and key_role == "service_role")
    admin_token = _admin.get("token", "")

    diagnostic_msg = ""
    if not SUPABASE_SERVICE_KEY:
        diagnostic_msg = "Falta SUPABASE_SERVICE_KEY en Hugging Face Spaces → Settings → Secrets."
    elif key_role == "anon":
        diagnostic_msg = "Has configurado la clave ANON (pública) en lugar de la clave SERVICE_ROLE (secreta). En Supabase ve a Settings → API y copia la clave 'service_role' secreta."
    
    registered_users = []
    user_eval_counts = {}
    evals_data = []

    # 1. Obtener todas las evaluaciones (Vía A: Service Key, Vía B: Token SuperAdmin)
    eval_headers_to_try = []
    if SUPABASE_SERVICE_KEY:
        eval_headers_to_try.append({"apikey": SUPABASE_SERVICE_KEY, "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}"})
    if admin_token:
        eval_headers_to_try.append({"apikey": SUPABASE_KEY, "Authorization": f"Bearer {admin_token}"})

    with httpx.Client(timeout=12.0) as client:
        for headers in eval_headers_to_try:
            try:
                r_evals = client.get(
                    f"{SUPABASE_URL}/rest/v1/evaluations?select=id,created_at,participant_id,age,ml_json,status,user_id&order=id.desc",
                    headers=headers
                )
                if r_evals.status_code == 200:
                    evals_data = r_evals.json()
                    if evals_data:
                        break
            except Exception as e:
                print("Error consultando evaluaciones REST:", e)

    # Si REST falló pero tenemos cliente SDK, intentar con SDK
    if not evals_data and SUPABASE_SERVICE_KEY:
        try:
            admin_opts = ClientOptions(httpx_client=httpx.Client(http2=False))
            sb_admin = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY, options=admin_opts)
            res_sdk = sb_admin.table('evaluations').select('id, created_at, participant_id, age, ml_json, status, user_id').order('id', desc=True).execute()
            evals_data = res_sdk.data or []
        except Exception as e:
            print("Error consultando evaluaciones SDK:", e)

    # Conteo de evaluaciones por user_id
    for ev in evals_data:
        uid = ev.get('user_id')
        if uid:
            user_eval_counts[uid] = user_eval_counts.get(uid, 0) + 1

    # 2. Obtener lista de usuarios de Supabase Auth
    # Intentar endpoint Admin Auth con Service Key
    if SUPABASE_SERVICE_KEY:
        try:
            with httpx.Client(timeout=12.0) as client:
                r_users = client.get(
                    f"{SUPABASE_URL}/auth/v1/admin/users?per_page=100",
                    headers={
                        "apikey": SUPABASE_SERVICE_KEY,
                        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}"
                    }
                )
                if r_users.status_code == 200:
                    raw_users = r_users.json().get("users", [])
                    for u in raw_users:
                        uid = u.get("id", "")
                        meta = u.get("user_metadata") or {}
                        registered_users.append({
                            "id": uid,
                            "email": u.get("email", "Sin correo"),
                            "created_at": u.get("created_at", ""),
                            "last_sign_in_at": u.get("last_sign_in_at"),
                            "role": meta.get("role", "psicólogo clínico"),
                            "evaluations_count": user_eval_counts.get(uid, 0)
                        })
        except Exception as e:
            print("Error consultando usuarios Auth REST:", e)

    # Si no se obtuvieron usuarios vía Auth API, poblar desde evaluaciones
    if not registered_users and user_eval_counts:
        for uid, count in user_eval_counts.items():
            registered_users.append({
                "id": uid,
                "email": f"Usuario {uid[:8]}...",
                "created_at": "",
                "last_sign_in_at": None,
                "role": "psicólogo clínico",
                "evaluations_count": count
            })

    # 3. Métricas agregadas y distribuciones
    total_evals = len(evals_data)
    total_psychologists = len(registered_users) if registered_users else len(user_eval_counts)

    daily_map = {}
    profile_map = {}
    today_key = datetime.now().strftime('%Y-%m-%d')
    today_count = 0

    for ev in evals_data:
        created = ev.get('created_at')
        if created:
            day = created[:10]
            daily_map[day] = daily_map.get(day, 0) + 1
            if day == today_key:
                today_count += 1
        
        ml = ev.get('ml_json') or {}
        prof = ml.get('predicted_profile')
        if prof:
            profile_map[prof] = profile_map.get(prof, 0) + 1

    daily_sorted = sorted(daily_map.items())
    top_profile = max(profile_map, key=profile_map.get) if profile_map else 'N/A'

    # 4. Formatear lista de evaluaciones recientes (hasta 50)
    # NOTA DE PRIVACIDAD: participant_id se enmascara como '******' para el SuperAdmin para proteger la identidad del paciente
    recent = []
    for r in evals_data[:50]:
        ml = r.get('ml_json') or {}
        recent.append({
            'id': r['id'],
            'created_at': r.get('created_at'),
            'participant_id': '******',
            'age': r.get('age'),
            'profile': (ml.get('predicted_profile') or 'N/A').replace('_', ' '),
            'confidence': ml.get('confidence_percent', 'N/A'),
            'status': r.get('status', 'completed'),
            'user_id': r.get('user_id', '')
        })

    return {
        'total_evaluations':    total_evals,
        'unique_psychologists': total_psychologists,
        'today_count':          today_count,
        'top_profile':          top_profile.replace('_', ' ') if top_profile != 'N/A' else 'N/A',
        'registered_users':     registered_users,
        'daily_distribution':   [{'date': d, 'count': c} for d, c in daily_sorted],
        'profile_distribution': [{'profile': k.replace('_', ' '), 'count': v}
                                 for k, v in sorted(profile_map.items(), key=lambda x: -x[1])],
        'recent_evaluations':   recent,
        'service_key_status':   'ok' if service_key_ok else 'warning',
        'key_role_detected':    key_role,
        'diagnostic_message':   diagnostic_msg
    }
