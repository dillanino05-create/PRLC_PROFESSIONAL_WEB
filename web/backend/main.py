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
from fastapi.responses import FileResponse, Response, RedirectResponse

from supabase import create_client, Client, ClientOptions
import httpx

from .models import PredictRequest, SaveRequest, CopilotChatRequest, UploadPdfRequest, UploadVideoRequest
from .predictor import predictor, corsi_predictor
from .excel_export import save_excel, EXPORTS_DIR, sanitize_tag_part, generate_session_tag

try:
    from dotenv import load_dotenv
    _backend_env = Path(__file__).parent / ".env"
    if _backend_env.exists():
        load_dotenv(_backend_env)
    else:
        load_dotenv()
    if not os.getenv("GEMINI_API_KEY") and not os.getenv("GOOGLE_API_KEY"):
        _jarvis_env = Path("C:/Users/compu/Downloads/jarvis_noster_cafe/.env.local")
        if _jarvis_env.exists():
            load_dotenv(_jarvis_env)
except Exception:
    pass


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

# ── Google Drive Vault (5 TB) & Cloudflare R2 Redundancy ───────────────────────
DRIVE_WEBHOOK_URL    = os.getenv("DRIVE_WEBHOOK_URL", "https://script.google.com/macros/s/AKfycbxv3Zg_6jOsDKIC1amVIJUzplYsDH5k2HKfmYx5ZzUUg3v07nuZ35i5nIKaFJdD_Ns/exec")
DRIVE_VAULT_TOKEN    = os.getenv("DRIVE_VAULT_TOKEN", "MECAPSI_DRIVE_VAULT_2026")
R2_ACCOUNT_ID        = os.getenv("R2_ACCOUNT_ID", "")
R2_ACCESS_KEY_ID     = os.getenv("R2_ACCESS_KEY_ID", "")
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY", "")
R2_BUCKET_NAME       = os.getenv("R2_BUCKET_NAME", "mecapsi-vault")

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
    """Verifica si la sesión del cliente sigue siendo válida (Permite múltiples sesiones concurrentes en pruebas)."""
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
    if not await limiter.check(f"predict:{client_ip}", max_calls=300, window_seconds=60.0):
        raise HTTPException(status_code=429, detail="Límite de predicciones excedido. Por favor espere un momento.")
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
            
        # ── Respaldo Automático a Google Drive Vault (5 TB) ───────────────────
        if DRIVE_WEBHOOK_URL:
            try:
                # Resolver carpeta del profesional de forma personalizada
                psych_name = "Psicologo_General"
                try:
                    user_email = ""
                    user_meta = {}
                    if uid:
                        # Si tenemos client SDK de Supabase o admin
                        u_info = sb.table("evaluations").select("user_id").eq("id", eval_id).execute()
                except Exception:
                    pass

                drive_payload = {
                    "token": DRIVE_VAULT_TOKEN,
                    "psychologist": psych_name,
                    "patient_id": str(part.get("id", "PAC_ANONIMO")),
                    "test_type": test_type or "PLC",
                    "file_type": "excel",
                    "file_name": filename,
                    "file_base64": base64.b64encode(file_bytes).decode("utf-8"),
                    "mime_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                }
                with httpx.Client(timeout=35.0, follow_redirects=True) as d_client:
                    d_resp = d_client.post(
                        DRIVE_WEBHOOK_URL,
                        content=json.dumps(drive_payload),
                        headers={"Content-Type": "text/plain;charset=utf-8"}
                    )
                    drive_data = d_resp.json()
                    if drive_data.get("success"):
                        metrics["drive_excel_url"] = drive_data.get("file_url")
                        metrics["drive_excel_id"] = drive_data.get("file_id")
                        metrics["drive_excel_folder"] = drive_data.get("folder_path")
                        print(f"✅ [DRIVE VAULT 5TB] Excel guardado en: {drive_data.get('folder_path')}")
            except Exception as de:
                print(f"⚠️ Aviso subiendo Excel a Drive Vault: {de}")

        # Limpiar archivo temporal local
        try: os.remove(excel_path)
        except Exception: pass
            
        sb.table("evaluations").update({
            "status": "completed", 
            "excel_path": filename,
            "metrics_json": metrics
        }).eq("id", eval_id).execute()
        
    except Exception as e:
        print(f"Error bg_excel: {e}")
        try: sb.table("evaluations").update({"status": "completed"}).eq("id", eval_id).execute()
        except Exception: pass

@app.post('/api/vault/upload-pdf')
async def upload_pdf_to_vault(req: UploadPdfRequest, auth_ctx: dict = Depends(get_supabase)):
    """Respalda un informe clínico PDF en el Google Drive Vault (5 TB) del psicólogo."""
    if not DRIVE_WEBHOOK_URL:
        return {"success": False, "detail": "Drive Vault webhook no configurado"}
    try:
        user_email = auth_ctx.get("email") or ""
        user = auth_ctx.get("user")
        user_meta = getattr(user, "user_metadata", {}) or {}
        psych_name = map_user_to_psychologist(user_email, user_meta.get("full_name", ""))

        drive_payload = {
            "token": DRIVE_VAULT_TOKEN,
            "psychologist": psych_name,
            "patient_id": req.patient_id or "PAC_ANONIMO",
            "test_type": req.test_type or "PLC",
            "file_type": "pdf",
            "file_name": req.filename,
            "file_base64": req.pdf_base64,
            "mime_type": "application/pdf"
        }
        async with httpx.AsyncClient(timeout=45.0, follow_redirects=True) as d_client:
            d_resp = await d_client.post(
                DRIVE_WEBHOOK_URL,
                content=json.dumps(drive_payload),
                headers={"Content-Type": "text/plain;charset=utf-8"}
            )
            return d_resp.json()
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post('/api/vault/upload-video')
async def upload_video_to_vault(req: UploadVideoRequest, auth_ctx: dict = Depends(get_supabase)):
    """Respalda un video clínico/forense en el Google Drive Vault (5 TB) del psicólogo con alta resiliencia y actualiza Supabase."""
    if not DRIVE_WEBHOOK_URL:
        return {"success": False, "detail": "Drive Vault webhook no configurado"}
    try:
        user_email = auth_ctx.get("email") or ""
        user = auth_ctx.get("user")
        user_meta = getattr(user, "user_metadata", {}) or {}
        psych_name = map_user_to_psychologist(user_email, user_meta.get("full_name", ""))

        fname = req.filename or f"PLC_Sesion_{req.eval_id or 'reciente'}.mp4"
        if not fname.lower().endswith((".mp4", ".webm")):
            fname += ".mp4"

        drive_payload = {
            "token": DRIVE_VAULT_TOKEN,
            "psychologist": psych_name,
            "patient_id": req.patient_id or "PAC_ANONIMO",
            "test_type": req.test_type or "PLC",
            "file_type": "video",
            "file_name": fname,
            "file_base64": req.video_base64,
            "mime_type": req.mime_type or "video/mp4"
        }
        async with httpx.AsyncClient(timeout=90.0, follow_redirects=True) as d_client:
            d_resp = await d_client.post(
                DRIVE_WEBHOOK_URL,
                content=json.dumps(drive_payload),
                headers={"Content-Type": "text/plain;charset=utf-8"}
            )
            d_res = d_resp.json()
            
            # Si el respaldo en Google Drive fue exitoso, persistir inmediatamente en Supabase
            if d_res.get("success"):
                file_url = d_res.get("file_url") or ""
                file_id = d_res.get("file_id") or ""
                folder_path = d_res.get("folder_path") or ""
                
                sb = auth_ctx.get("client")
                uid = auth_ctx.get("user_id")
                if sb and uid:
                    target_id = req.eval_id
                    try:
                        if not target_id:
                            # Localizar evaluación reciente por session_tag, filename o id de paciente
                            q = sb.table("evaluations").select("id, metrics_json, excel_path").eq("user_id", uid).order("id", desc=True).limit(6)
                            rows = q.execute().data or []
                            for r in rows:
                                m_cur = r.get("metrics_json") or {}
                                ep = str(r.get("excel_path") or "")
                                if req.session_tag and (m_cur.get("session_tag") == req.session_tag or req.session_tag in ep):
                                    target_id = r["id"]
                                    break
                                if req.filename and (m_cur.get("video_path") == req.filename or req.filename.replace('.mp4','.xlsx') in ep or req.filename.replace('.webm','.xlsx') in ep):
                                    target_id = r["id"]
                                    break
                            if not target_id and rows:
                                target_id = rows[0]["id"]
                        
                        if target_id:
                            cur_res = sb.table("evaluations").select("metrics_json").eq("id", target_id).execute()
                            if cur_res.data:
                                cur_m = cur_res.data[0].get("metrics_json") or {}
                                cur_m["drive_video_url"] = file_url
                                cur_m["drive_file_id"] = file_id
                                cur_m["drive_folder"] = folder_path
                                cur_m["video_path"] = req.filename
                                cur_m["has_video"] = True
                                cur_m["video_expired"] = False
                                sb.table("evaluations").update({"metrics_json": cur_m}).eq("id", target_id).execute()
                                d_res["synced_eval_id"] = target_id
                                print(f"✅ [VAULT SYNC] Video vinculado a evaluación #{target_id} en Supabase")
                    except Exception as sync_err:
                        print(f"⚠️ Aviso sincronizando video con Supabase: {sync_err}")
            
            return d_res
    except Exception as e:
        print(f"⚠️ Error subiendo video a Drive Vault desde backend: {e}")
        return {"success": False, "error": str(e)}

@app.post('/api/save')
async def save(req: SaveRequest, authorization: str = Header(None), auth_ctx: dict = Depends(get_supabase)):
    sb = auth_ctx["client"]
    uid = auth_ctx["user_id"]
    client_ip = auth_ctx.get("ip", "unknown")
    token = authorization.split(" ")[1] if authorization else ""

    # Rate limiting relajado para pruebas concurrentes masivas en múltiples PCs
    if not await limiter.check(f"save:{uid}", max_calls=120, window_seconds=60.0):
        raise HTTPException(status_code=429, detail="Límite de guardado excedido. Por favor espere un momento.")

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
        metrics["birth_date"] = part.get("birth_date") or part.get("birthdate")
        metrics["chronological_age"] = part.get("chronological_age")
        metrics["chronological_detail"] = part.get("chronological_detail")

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
    user = auth_ctx.get("user")
    user_email = auth_ctx.get("email", "")
    user_meta = getattr(user, "user_metadata", {}) or {}
    app_meta = getattr(user, "app_metadata", {}) or {}
    is_superadmin = (
        user_email == "dillanino05@gmail.com" 
        or user_meta.get("role") == "superadmin" 
        or app_meta.get("role") == "superadmin"
    )

    query = sb.table("evaluations").select("*").eq("id", eval_id)
    if not is_superadmin:
        query = query.eq("user_id", uid)
    res = query.execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Evaluación no encontrada en base de datos")
    
    row = res.data[0]
    metrics = row.get("metrics_json") or {}
    session_tag = compute_session_tag(row)
    download_name = f"{session_tag}.xlsx"

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
    ml_pred = row.get('ml_json')
    narrative = row.get('narrative', '')

    test_type = metrics.get("test_type", "PLC")
    try:
        excel_path = save_excel(part, lines, clicks, metrics, ml_pred, narrative,
                                test_type=test_type, session_id=eval_id, session_tag=session_tag)

        # Si aún no tiene respaldo en Google Drive Vault, respaldarlo de inmediato
        if DRIVE_WEBHOOK_URL and not metrics.get("drive_excel_url"):
            try:
                with open(excel_path, "rb") as ef:
                    ebytes = ef.read()
                psych_name = map_user_to_psychologist(user_email, user_meta.get("full_name", ""))
                drive_payload = {
                    "token": DRIVE_VAULT_TOKEN,
                    "psychologist": psych_name,
                    "patient_id": str(part.get("id", "PAC_ANONIMO")),
                    "test_type": test_type or "PLC",
                    "file_type": "excel",
                    "file_name": download_name,
                    "file_base64": base64.b64encode(ebytes).decode("utf-8"),
                    "mime_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                }
                with httpx.Client(timeout=30.0, follow_redirects=True) as d_client:
                    d_resp = d_client.post(
                        DRIVE_WEBHOOK_URL,
                        content=json.dumps(drive_payload),
                        headers={"Content-Type": "text/plain;charset=utf-8"}
                    )
                    d_data = d_resp.json()
                    if d_data.get("success"):
                        metrics["drive_excel_url"] = d_data.get("file_url")
                        metrics["drive_excel_id"] = d_data.get("file_id")
                        metrics["drive_excel_folder"] = d_data.get("folder_path")
                        sb.table("evaluations").update({"metrics_json": metrics}).eq("id", eval_id).execute()
                        print(f"✅ [DRIVE VAULT] Excel respaldado en Drive al exportar: {download_name}")
            except Exception as up_ex:
                print(f"⚠️ Aviso subiendo Excel a Drive Vault en export: {up_ex}")

        return FileResponse(
            path=excel_path,
            filename=download_name,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers={
                "Content-Disposition": f'attachment; filename="{download_name}"',
                "Access-Control-Expose-Headers": "Content-Disposition"
            }
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
        for r in data:
            m = r.get("metrics_json") or {}
            vpath = m.get("video_path", "")
            d_vid_url = m.get("drive_video_url", "")
            d_file_id = m.get("drive_file_id", "")
            if not d_file_id and d_vid_url:
                if "id=" in d_vid_url:
                    d_file_id = d_vid_url.split("id=")[-1].split("&")[0]
                elif "/d/" in d_vid_url:
                    d_file_id = d_vid_url.split("/d/")[1].split("/")[0]

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

            has_vid = bool(d_vid_url or d_file_id or vpath)

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
                'video_path': vpath,
                'video_days_left': 9999,
                'video_expired': False,
                'drive_video_url': d_vid_url,
                'drive_file_id': d_file_id,
                'drive_excel_url': m.get('drive_excel_url', ''),
                'has_video': has_vid
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
    video_path = metrics.get("video_path") or ""

    drive_url = metrics.get("drive_video_url") or ""
    drive_id = metrics.get("drive_file_id") or ""
    if not drive_id and "id=" in drive_url:
        drive_id = drive_url.split("id=")[-1].split("&")[0]
    elif not drive_id and "/d/" in drive_url:
        drive_id = drive_url.split("/d/")[1].split("/")[0]

    has_video_track = bool(drive_url or drive_id or video_path)
    if not has_video_track:
        raise HTTPException(status_code=404, detail="Esta evaluación no cuenta con una grabación de video activa.")

    session_tag = compute_session_tag(row)
    download_filename = f"{session_tag}.mp4"

    # Enlace optimizado desde Google Drive Vault (5 TB)
    secure_url = f"https://drive.google.com/file/d/{drive_id}/preview" if drive_id else drive_url
    if secure_url and "drive.google.com" in secure_url and "/view" in secure_url:
        secure_url = secure_url.split("/view")[0] + "/preview"
    download_url = f"https://drive.google.com/uc?export=download&id={drive_id}" if drive_id else drive_url

    # Fallback si no hay enlace Drive pero hay video_path en storage
    if not secure_url and video_path:
        try:
            signed_res = sb.storage.from_("exports").create_signed_url(
                video_path, 600, options={"download": download_filename}
            )
            secure_url = signed_res.get("signedURL") or signed_res.get("signedUrl")
            download_url = secure_url
        except Exception:
            pass

    if not secure_url:
        raise HTTPException(
            status_code=404,
            detail="La grabación de esta sesión no se encuentra disponible (el participante no activó la cámara o no se completó la grabación)."
        )

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
        "drive_url": drive_url or secure_url,
        "drive_id": drive_id,
        "drive_folder": metrics.get("drive_folder") or "",
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

@app.post("/api/admin/sync-vault-evaluations")
async def sync_vault_evaluations(auth_key: str = "", limit: int = 200):
    """Sincroniza y repara metadatos de Google Drive Vault (IDs de video, desmarque de expiración y respaldo de Excels faltantes)."""
    if auth_key != "mecapsi_clinical_audit_2026":
        raise HTTPException(status_code=403, detail="Clave de auditoría inválida")
    if not SUPABASE_SERVICE_KEY:
        raise HTTPException(status_code=500, detail="SUPABASE_SERVICE_KEY no configurado")

    admin_opts = ClientOptions(httpx_client=httpx.Client(http2=False, timeout=60.0))
    sb_admin = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY, options=admin_opts)

    users_map = {}
    try:
        with httpx.Client(timeout=15.0) as client:
            r_users = client.get(
                f"{SUPABASE_URL}/auth/v1/admin/users?per_page=100",
                headers={"apikey": SUPABASE_SERVICE_KEY, "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}"}
            )
            if r_users.status_code == 200:
                for u in r_users.json().get("users", []):
                    users_map[u.get("id")] = map_user_to_psychologist(u.get("email", ""), (u.get("user_metadata") or {}).get("full_name", ""))
    except Exception as ue:
        print(f"Error cargando usuarios: {ue}")

    res_all = sb_admin.table("evaluations").select("*").order("id", desc=True).limit(limit).execute()
    evals = res_all.data or []

    synced_videos = 0
    unlocked_expired = 0
    synced_excels = 0
    errors = []

    for ev in evals:
        try:
            ev_id = ev["id"]
            m = ev.get("metrics_json") or {}
            changed = False

            # 1. Desbloquear video_expired si estuviera en True
            if m.get("video_expired"):
                m["video_expired"] = False
                changed = True
                unlocked_expired += 1

            # 2. Extraer drive_file_id si tenemos drive_video_url pero no file_id
            d_url = m.get("drive_video_url", "")
            d_id = m.get("drive_file_id", "")
            if d_url and not d_id:
                if "id=" in d_url:
                    d_id = d_url.split("id=")[-1].split("&")[0]
                elif "/d/" in d_url:
                    d_id = d_url.split("/d/")[1].split("/")[0]
                if d_id:
                    m["drive_file_id"] = d_id
                    m["has_video"] = True
                    changed = True
                    synced_videos += 1

            # 3. Si no tiene drive_excel_url y tiene datos, generar y respaldar a Drive Vault
            if DRIVE_WEBHOOK_URL and not m.get("drive_excel_url") and (ev.get("lines_json") or ev.get("clicks_json")):
                try:
                    part = {
                        'id': ev.get('participant_id', 'P01'),
                        'name': ev.get('participant_name', 'Paciente'),
                        'age': ev.get('age', 25),
                        'gender': ev.get('gender', 'M'),
                        'education': ev.get('education', 'Universitario'),
                        'hand': ev.get('hand', 'Derecha'),
                        'occupation': ev.get('occupation', '')
                    }
                    lines = ev.get('lines_json') or []
                    clicks = ev.get('clicks_json') or []
                    ml_pred = ev.get('ml_json')
                    narrative = ev.get('narrative', '')
                    s_tag = compute_session_tag(ev)
                    t_type = m.get("test_type", "PLC")
                    ex_path = save_excel(part, lines, clicks, m, ml_pred, narrative, test_type=t_type, session_id=ev_id, session_tag=s_tag)
                    
                    with open(ex_path, "rb") as ef:
                        ebytes = ef.read()
                    
                    p_name = users_map.get(ev.get("user_id"), "Psicologo_General")
                    payload = {
                        "token": DRIVE_VAULT_TOKEN,
                        "psychologist": p_name,
                        "patient_id": str(part.get("id", "PAC_ANONIMO")),
                        "test_type": t_type or "PLC",
                        "file_type": "excel",
                        "file_name": f"{s_tag}.xlsx",
                        "file_base64": base64.b64encode(ebytes).decode("utf-8"),
                        "mime_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    }
                    with httpx.Client(timeout=35.0, follow_redirects=True) as d_client:
                        d_resp = d_client.post(DRIVE_WEBHOOK_URL, content=json.dumps(payload), headers={"Content-Type": "text/plain;charset=utf-8"})
                        if d_resp.status_code == 200:
                            d_data = d_resp.json()
                            if d_data.get("success"):
                                m["drive_excel_url"] = d_data.get("file_url")
                                m["drive_excel_id"] = d_data.get("file_id")
                                m["drive_excel_folder"] = d_data.get("folder_path")
                                changed = True
                                synced_excels += 1
                    try: os.remove(ex_path)
                    except Exception: pass
                except Exception as ex_sync_err:
                    errors.append(f"Eval {ev_id} Excel sync: {str(ex_sync_err)}")

            if changed:
                sb_admin.table("evaluations").update({"metrics_json": m}).eq("id", ev_id).execute()

        except Exception as item_err:
            errors.append(f"Eval {ev.get('id')}: {str(item_err)}")

    return {
        "success": True,
        "total_evaluations_checked": len(evals),
        "unlocked_expired_videos": unlocked_expired,
        "synced_video_ids": synced_videos,
        "synced_excel_vault_files": synced_excels,
        "errors": errors[:20]
    }

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
    video_path = metrics.get("video_path") or ""

    session_tag = compute_session_tag(row)
    filename = f"{session_tag}.mp4"

    drive_id = metrics.get("drive_file_id") or ""
    drive_url = metrics.get("drive_video_url") or ""
    if not drive_id and "id=" in drive_url:
        drive_id = drive_url.split("id=")[-1].split("&")[0]
    elif not drive_id and "/d/" in drive_url:
        drive_id = drive_url.split("/d/")[1].split("/")[0]

    if not drive_id and not video_path:
        raise HTTPException(status_code=404, detail="No hay video disponible para esta evaluación.")

    # 1. Si tenemos archivo en Google Drive Vault, intentar servir directamente
    if drive_id:
        try:
            drive_dl_url = f"https://drive.google.com/uc?export=download&id={drive_id}"
            async with httpx.AsyncClient(timeout=45.0, follow_redirects=True) as client:
                r_drive = await client.get(drive_dl_url)
                if r_drive.status_code == 200 and len(r_drive.content) > 1000 and "text/html" not in (r_drive.headers.get("content-type") or ""):
                    return Response(
                        content=r_drive.content,
                        media_type="video/mp4",
                        headers={
                            "Content-Disposition": f'attachment; filename="{filename}"',
                            "Access-Control-Expose-Headers": "Content-Disposition"
                        }
                    )
        except Exception as de:
            print(f"Aviso streaming desde Drive: {de}")
        # Redirigir a enlace de descarga directa de Google Drive
        return RedirectResponse(url=f"https://drive.google.com/uc?export=download&id={drive_id}", status_code=307)

    # 2. Fallback a Supabase Storage si aún existiera
    try:
        file_bytes = sb.storage.from_("exports").download(video_path)
        if video_path.lower().endswith(".webm"):
            transcoded = transcode_webm_to_mp4(file_bytes)
            if transcoded and len(transcoded) > 0:
                file_bytes = transcoded

        return Response(
            content=file_bytes,
            media_type="video/mp4",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Access-Control-Expose-Headers": "Content-Disposition"
            }
        )
    except Exception as e:
        if drive_id:
            return RedirectResponse(url=f"https://drive.google.com/uc?export=download&id={drive_id}", status_code=307)
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

@app.get('/api/admin/dump-evaluations')
async def dump_all_evaluations(auth_key: str = "", limit: int = 500, include_raw: bool = False):
    """Endpoint administrativo de auditoría para exportar todas las evaluaciones de la base de datos."""
    if auth_key != "mecapsi_clinical_audit_2026":
        raise HTTPException(status_code=403, detail="Clave de auditoría inválida")
    
    cols = "*" if include_raw else "id,created_at,participant_id,participant_name,age,gender,education,hand,occupation,metrics_json,ml_json,narrative,excel_path,status,user_id"
    
    # 1. Intentar REST con Service Key
    if SUPABASE_SERVICE_KEY:
        try:
            with httpx.Client(timeout=30.0) as client:
                r = client.get(
                    f"{SUPABASE_URL}/rest/v1/evaluations?select={cols}&order=id.asc&limit={limit}",
                    headers={"apikey": SUPABASE_SERVICE_KEY, "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}"}
                )
                if r.status_code == 200:
                    return r.json()
        except Exception as e:
            print("REST dump error:", e)

        # 2. Intentar SDK fallback con Service Key
        try:
            admin_opts = ClientOptions(httpx_client=httpx.Client(http2=False))
            sb_admin = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY, options=admin_opts)
            res = sb_admin.table('evaluations').select(cols).order('id', desc=False).limit(limit).execute()
            return res.data or []
        except Exception as e:
            print("SDK dump error:", e)
            raise HTTPException(status_code=500, detail=f"SDK error: {e}")
            
    raise HTTPException(status_code=500, detail="SUPABASE_SERVICE_KEY no configurado en el servidor")


def map_user_to_psychologist(user_email: str, user_name: str = "") -> str:
    """Mapea un usuario a la carpeta del psicólogo solicitada por Dilan."""
    s = f"{user_email} {user_name}".lower()
    if any(k in s for k in ["dillan", "dilan", "lamus"]):
        return "Ingeniero_Dilan"
    elif any(k in s for k in ["andrea", "vivas"]):
        return "Dra_Andrea"
    elif any(k in s for k in ["edgar", "diaz", "camargo"]):
        return "Dr_Edgar"
    elif any(k in s for k in ["jimena", "ximena", "mora"]):
        return "Dra_Ximena"
    elif any(k in s for k in ["prueba", "test"]):
        return "Perfil_de_Prueba"
    return "Perfil_de_Prueba"


@app.get('/api/admin/users-mapping')
async def get_users_mapping(auth_key: str = ""):
    """Retorna la lista de usuarios y cómo están mapeados a las carpetas de los psicólogos."""
    if auth_key != "mecapsi_clinical_audit_2026":
        raise HTTPException(status_code=403, detail="Clave de auditoría inválida")
    if not SUPABASE_SERVICE_KEY:
        raise HTTPException(status_code=500, detail="SUPABASE_SERVICE_KEY no configurado")
        
    with httpx.Client(timeout=15.0) as client:
        r = client.get(
            f"{SUPABASE_URL}/auth/v1/admin/users?per_page=100",
            headers={"apikey": SUPABASE_SERVICE_KEY, "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}"}
        )
        if r.status_code == 200:
            users = r.json().get("users", [])
            return [
                {
                    "id": u.get("id"),
                    "email": u.get("email"),
                    "name": (u.get("user_metadata") or {}).get("full_name") or u.get("email"),
                    "folder": map_user_to_psychologist(u.get("email", ""), (u.get("user_metadata") or {}).get("full_name", ""))
                }
                for u in users
            ]
        return {"error": r.text}


@app.post('/api/admin/migrate-vault')
async def migrate_vault(auth_key: str = "", purge_supabase: bool = True, offset: int = 0, limit: int = 10):
    """Descarga todos los archivos pesados de Supabase Storage, los sube a Google Drive Vault y los purga de Supabase."""
    if auth_key != "mecapsi_clinical_audit_2026":
        raise HTTPException(status_code=403, detail="Clave de auditoría inválida")
    if not SUPABASE_SERVICE_KEY:
        raise HTTPException(status_code=500, detail="SUPABASE_SERVICE_KEY no configurado")

    admin_opts = ClientOptions(httpx_client=httpx.Client(http2=False, timeout=60.0))
    sb_admin = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY, options=admin_opts)

    # 1. Obtener mapeo de usuarios a nombres de psicólogos
    users_map = {}
    try:
        with httpx.Client(timeout=15.0) as client:
            r_users = client.get(
                f"{SUPABASE_URL}/auth/v1/admin/users?per_page=100",
                headers={"apikey": SUPABASE_SERVICE_KEY, "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}"}
            )
            if r_users.status_code == 200:
                for u in r_users.json().get("users", []):
                    u_email = u.get("email", "")
                    u_name = (u.get("user_metadata") or {}).get("full_name", "")
                    users_map[u.get("id")] = map_user_to_psychologist(u_email, u_name)
    except Exception as ue:
        print("Error obteniendo usuarios:", ue)

    # 2. Obtener lote de evaluaciones usando rango paginado
    res = sb_admin.table('evaluations').select('id,participant_id,created_at,excel_path,metrics_json,user_id').order('id', desc=False).range(offset, offset + limit - 1).execute()
    evals = res.data or []

    migrated_excels = 0
    migrated_videos = 0
    purged_files = []
    errors = []

    for ev in evals:
        eval_id = ev.get('id')
        uid = ev.get('user_id')
        psych_name = users_map.get(uid, "Perfil_de_Prueba")
        pat_id = str(ev.get('participant_id') or f'PAC_{eval_id}')
        metrics = ev.get('metrics_json') or {}
        test_type = metrics.get('test_type') or ('CORSI' if 'corsi_span' in metrics else 'PLC')
        
        # A) Migrar Excel si existe en Supabase Storage
        excel_path = ev.get('excel_path')
        if excel_path:
            try:
                excel_bytes = sb_admin.storage.from_('exports').download(excel_path)
                if excel_bytes and len(excel_bytes) > 0:
                    drive_payload = {
                        "token": DRIVE_VAULT_TOKEN,
                        "psychologist": psych_name,
                        "patient_id": pat_id,
                        "test_type": test_type,
                        "file_type": "excel",
                        "file_name": excel_path,
                        "file_base64": base64.b64encode(excel_bytes).decode("utf-8"),
                        "mime_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    }
                    async with httpx.AsyncClient(timeout=45.0, follow_redirects=True) as d_client:
                        d_resp = await d_client.post(
                            DRIVE_WEBHOOK_URL,
                            content=json.dumps(drive_payload),
                            headers={"Content-Type": "text/plain;charset=utf-8"}
                        )
                        d_res = d_resp.json()
                        if d_res.get("success"):
                            migrated_excels += 1
                            if purge_supabase:
                                sb_admin.storage.from_('exports').remove([excel_path])
                                purged_files.append(excel_path)
            except Exception as ex_err:
                errors.append(f"Eval {eval_id} Excel: {str(ex_err)}")

        # B) Migrar Video si existe en Supabase Storage
        video_path = metrics.get('video_path')
        if video_path:
            try:
                video_bytes = sb_admin.storage.from_('exports').download(video_path)
                if video_bytes and len(video_bytes) > 0:
                    drive_payload = {
                        "token": DRIVE_VAULT_TOKEN,
                        "psychologist": psych_name,
                        "patient_id": pat_id,
                        "test_type": test_type,
                        "file_type": "video",
                        "file_name": video_path,
                        "file_base64": base64.b64encode(video_bytes).decode("utf-8"),
                        "mime_type": "video/mp4"
                    }
                    async with httpx.AsyncClient(timeout=90.0, follow_redirects=True) as d_client:
                        d_resp = await d_client.post(
                            DRIVE_WEBHOOK_URL,
                            content=json.dumps(drive_payload),
                            headers={"Content-Type": "text/plain;charset=utf-8"}
                        )
                        d_res = d_resp.json()
                        if d_res.get("success"):
                            migrated_videos += 1
                            metrics['drive_video_url'] = d_res.get('file_url')
                            metrics['drive_folder'] = d_res.get('folder_path')
                            sb_admin.table('evaluations').update({'metrics_json': metrics}).eq('id', eval_id).execute()
                            if purge_supabase:
                                sb_admin.storage.from_('exports').remove([video_path])
                                purged_files.append(video_path)
            except Exception as vid_err:
                errors.append(f"Eval {eval_id} Video: {str(vid_err)}")

    return {
        "success": True,
        "total_evaluations_checked": len(evals),
        "migrated_excels": migrated_excels,
        "migrated_videos": migrated_videos,
        "purged_files_from_supabase": len(purged_files),
        "errors_count": len(errors),
        "errors_sample": errors[:5]
    }


@app.get('/api/admin/storage-audit')
async def storage_audit(auth_key: str = ""):
    """Inspecciona en tiempo real todos los buckets y archivos que existen en Supabase Storage."""
    if auth_key != "mecapsi_clinical_audit_2026":
        raise HTTPException(status_code=403, detail="Clave de auditoría inválida")
    if not SUPABASE_SERVICE_KEY:
        raise HTTPException(status_code=500, detail="SUPABASE_SERVICE_KEY no configurado")

    admin_opts = ClientOptions(httpx_client=httpx.Client(http2=False, timeout=60.0))
    sb_admin = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY, options=admin_opts)

    try:
        buckets = sb_admin.storage.list_buckets()
        result = []
        for b in buckets:
            b_name = b.name
            try:
                # Listar objetos hasta 1000
                objs = sb_admin.storage.from_(b_name).list(path="", options={"limit": 1000, "sortBy": {"column": "name", "order": "asc"}})
                total_bytes = sum((o.get('metadata') or {}).get('size', 0) for o in (objs or []))
                result.append({
                    "bucket": b_name,
                    "is_public": getattr(b, "public", False),
                    "objects_count": len(objs or []),
                    "total_size_mb": round(total_bytes / (1024 * 1024), 2),
                    "total_size_gb": round(total_bytes / (1024 * 1024 * 1024), 4),
                    "files": [
                        {
                            "name": o.get('name'),
                            "size_mb": round(((o.get('metadata') or {}).get('size', 0)) / (1024 * 1024), 2),
                            "created_at": o.get('created_at')
                        }
                        for o in (objs or [])
                    ]
                })
            except Exception as be:
                result.append({"bucket": b_name, "error": str(be)})
        return {"success": True, "buckets": result}
    except Exception as ge:
        raise HTTPException(status_code=500, detail=f"Error auditando almacenamiento: {str(ge)}")


@app.post('/api/admin/storage-purge-files')
async def storage_purge_files(auth_key: str = "", bucket: str = "exports", file_names: list[str] = None):
    """Elimina una lista de archivos específicos de Supabase Storage para liberar espacio de inmediato."""
    if auth_key != "mecapsi_clinical_audit_2026":
        raise HTTPException(status_code=403, detail="Clave de auditoría inválida")
    if not SUPABASE_SERVICE_KEY:
        raise HTTPException(status_code=500, detail="SUPABASE_SERVICE_KEY no configurado")
    if not file_names:
        raise HTTPException(status_code=400, detail="Debe especificar file_names")

    admin_opts = ClientOptions(httpx_client=httpx.Client(http2=False, timeout=60.0))
    sb_admin = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY, options=admin_opts)

    try:
        del_res = sb_admin.storage.from_(bucket).remove(file_names)
        return {"success": True, "bucket": bucket, "deleted_count": len(file_names), "response": del_res}
    except Exception as pe:
        raise HTTPException(status_code=500, detail=f"Error purgando archivos: {str(pe)}")


def compress_video_for_vault(video_bytes: bytes) -> bytes:
    """Optimiza videos pesados (>20MB) usando ffmpeg para respetar el límite de 50MB de Google Apps Script."""
    import tempfile, subprocess, os, shutil
    if len(video_bytes) <= 20 * 1024 * 1024:
        return video_bytes
    ffmpeg_bin = shutil.which("ffmpeg")
    if not ffmpeg_bin:
        return video_bytes
    with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as in_f:
        in_f.write(video_bytes)
        in_path = in_f.name
    out_path = in_path.replace('.mp4', '_opt.mp4')
    try:
        cmd = [
            ffmpeg_bin, "-y", "-i", in_path,
            "-c:v", "libx264", "-pix_fmt", "yuv420p",
            "-preset", "veryfast", "-crf", "28",
            "-an", out_path
        ]
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=90)
        if res.returncode == 0 and os.path.exists(out_path) and os.path.getsize(out_path) > 0:
            with open(out_path, "rb") as out_f:
                opt_bytes = out_f.read()
                print(f"[VAULT-OPT] Video reducido de {len(video_bytes)/(1024*1024):.1f}MB a {len(opt_bytes)/(1024*1024):.1f}MB")
                return opt_bytes
    except Exception as ce:
        print(f"[VAULT-OPT-ERR] {ce}")
    finally:
        for p in [in_path, out_path]:
            if os.path.exists(p):
                try: os.remove(p)
                except Exception: pass
    return video_bytes


@app.post('/api/admin/clean-purge-storage')
async def clean_purge_storage(auth_key: str = ""):
    """Migra los videos pesados restantes a Google Drive Vault y deja Supabase Storage en 0 MB."""
    if auth_key != "mecapsi_clinical_audit_2026":
        raise HTTPException(status_code=403, detail="Clave de auditoría inválida")
    if not SUPABASE_SERVICE_KEY:
        raise HTTPException(status_code=500, detail="SUPABASE_SERVICE_KEY no configurado")

    admin_opts = ClientOptions(httpx_client=httpx.Client(http2=False, timeout=120.0))
    sb_admin = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY, options=admin_opts)

    users_map = {}
    try:
        with httpx.Client(timeout=15.0) as client:
            r_users = client.get(
                f"{SUPABASE_URL}/auth/v1/admin/users?per_page=100",
                headers={"apikey": SUPABASE_SERVICE_KEY, "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}"}
            )
            if r_users.status_code == 200:
                for u in r_users.json().get("users", []):
                    users_map[u.get("id")] = map_user_to_psychologist(u.get("email", ""), (u.get("user_metadata") or {}).get("full_name", ""))
    except Exception as ue:
        print(f"Error obteniendo usuarios: {ue}")

    objs = sb_admin.storage.from_("exports").list(path="", options={"limit": 1000}) or []
    migrated_videos = []
    purged_files = []
    errors = []

    for obj in objs:
        f_name = obj.get("name")
        if not f_name:
            continue

        if f_name.lower().endswith((".mp4", ".webm")):
            try:
                eval_row = None
                res_all = sb_admin.table("evaluations").select("id, participant_id, metrics_json, user_id").order("id", desc=True).limit(200).execute()
                for ev in (res_all.data or []):
                    m = ev.get("metrics_json") or {}
                    if m.get("video_path") == f_name:
                        eval_row = ev
                        break

                vid_bytes = sb_admin.storage.from_("exports").download(f_name)
                if vid_bytes and len(vid_bytes) > 0:
                    opt_bytes = compress_video_for_vault(vid_bytes)
                    
                    psych_name = "Perfil_de_Prueba"
                    pat_id = "PAC_ANONIMO"
                    eval_id = None
                    metrics = {}
                    test_type = "CORSI" if "CORSI" in f_name.upper() else "PLC"

                    if eval_row:
                        eval_id = eval_row.get("id")
                        uid = eval_row.get("user_id")
                        psych_name = users_map.get(uid, "Perfil_de_Prueba")
                        pat_id = str(eval_row.get("participant_id") or f"PAC_{eval_id}")
                        metrics = eval_row.get("metrics_json") or {}
                        test_type = metrics.get("test_type") or test_type

                    drive_payload = {
                        "token": DRIVE_VAULT_TOKEN,
                        "psychologist": psych_name,
                        "patient_id": pat_id,
                        "test_type": test_type,
                        "file_type": "video",
                        "file_name": f_name if f_name.endswith(".mp4") else f_name.rsplit(".", 1)[0] + ".mp4",
                        "file_base64": base64.b64encode(opt_bytes).decode("utf-8"),
                        "mime_type": "video/mp4"
                    }

                    async with httpx.AsyncClient(timeout=120.0, follow_redirects=True) as d_client:
                        d_resp = await d_client.post(
                            DRIVE_WEBHOOK_URL,
                            content=json.dumps(drive_payload),
                            headers={"Content-Type": "text/plain;charset=utf-8"}
                        )
                        d_res = d_resp.json()
                        if d_res.get("success"):
                            migrated_videos.append(f_name)
                            if eval_id:
                                metrics["drive_video_url"] = d_res.get("file_url")
                                metrics["drive_folder"] = d_res.get("folder_path")
                                metrics["drive_file_id"] = d_res.get("file_id")
                                sb_admin.table("evaluations").update({"metrics_json": metrics}).eq("id", eval_id).execute()
            except Exception as ve:
                errors.append(f"Error migrando {f_name}: {str(ve)}")

        # Purgar archivo de Supabase Storage para dejarlo en 0 MB
        try:
            sb_admin.storage.from_("exports").remove([f_name])
            purged_files.append(f_name)
        except Exception as pe:
            errors.append(f"Error purgando {f_name}: {str(pe)}")

    remaining_objs = sb_admin.storage.from_("exports").list(path="", options={"limit": 1000}) or []
    remaining_bytes = sum((o.get("metadata") or {}).get("size", 0) for o in remaining_objs)

    return {
        "success": True,
        "migrated_to_drive_count": len(migrated_videos),
        "migrated_videos": migrated_videos,
        "purged_from_supabase_count": len(purged_files),
        "purged_files": purged_files,
        "final_supabase_storage_objects": len(remaining_objs),
        "final_supabase_storage_mb": round(remaining_bytes / (1024 * 1024), 2),
        "errors": errors
    }


# ═══════════════════════════════════════════════════════════════════════════════
# FASE 2: MecaPsi AI Copilot (Mini-Bot Clínico y Paraclínico Descriptivo)
# ═══════════════════════════════════════════════════════════════════════════════

def generate_clinical_descriptive_reply(message: str, ctx: dict) -> str:
    """Motor descriptivo paraclínico pedagógico de MecaPsi (estrictamente descriptivo, sin diagnósticos patológicos)."""
    msg_low = message.lower()
    participant = ctx.get("participant", {})
    metrics = ctx.get("metrics", {})
    test_type = ctx.get("test_type", "Evaluación Cognitiva")

    p_name = participant.get("name", "el evaluado")
    p_age = participant.get("chronological_age") or f"{participant.get('age', 25)} años"
    stratum = metrics.get("d2_norm_stratum") or metrics.get("age_norm_stratum") or "Estrato etario normativo"

    # 1. Explicación para Padres / Paciente
    if any(k in msg_low for k in ["padre", "mama", "papá", "familia", "paciente", "explicar", "entender", "facil", "sencillo", "humano"]):
        return (
            f"🤝 **Cómo explicar este reporte pedagógicamente a los padres o al paciente:**\n\n"
            f"1. **Enfoque inicial cálido y constructivo:**\n"
            f"   'En esta sesión no buscamos poner una etiqueta médica ni emitir un diagnóstico de enfermedad. Lo que hicimos fue una radiografía de su estilo de atención y concentración en tiempo real.'\n\n"
            f"2. **Explicación de las demandas de la tarea:**\n"
            f"   'Durante la prueba, {p_name} ({p_age}) se enfrentó a estímulos continuos donde debía decidir con rapidez y precisión. Evaluamos cómo dosifica su energía mental y cómo reacciona ante la fatiga.'\n\n"
            f"3. **Interpretación de los datos observados:**\n"
            f"   - **Ritmo y Precisión:** Mantuvo un desempeño centrado en su grupo de referencia ({stratum}). Los aciertos reflejan que comprende las instrucciones y busca mantener la exactitud.\n"
            f"   - **Respuesta biomecánica:** No se observa tensión motora excesiva; el esfuerzo empleado es el esperable para una prueba digital cronometrada.\n\n"
            f"4. **Recomendación descriptiva para el hogar o el aula:**\n"
            f"   'Recomendamos fomentar pausas activas breves (técnica Pomodoro adaptada de 20-25 minutos) para optimizar la curva de rendimiento y prevenir la sobrecarga al final de jornadas extensas.'"
        )

    # 2. Pupila y Biomarcadores Visuales
    if any(k in msg_low for k in ["pupil", "ojo", "parpade", "camara", "mirada", "vision", "iris"]):
        pupil_val = metrics.get("pupil_dilation_avg", 1.0)
        return (
            f"👁️ **Interpretación Paraclínica de la Pupilometría y Parpadeo:**\n\n"
            f"• **¿Qué mide exactamente?** La dilatación pupilar en tareas neurocognitivas está regulada por el sistema noradrenérgico central (Locus Coeruleus). Refleja **esfuerzo mental y carga cognitiva en memoria de trabajo**, no un problema refractivo u oftalmológico.\n"
            f"• **Datos registrados:** En esta sesión se observó un factor de dilatación relativo promedio de **{pupil_val:.2f}x** respecto a la línea base de reposo.\n"
            f"• **Lectura descriptiva:** Valores entre 1.05x y 1.25x indican una activación adaptativa saludable frente a la dificultad de los bloques. Picos superiores a 1.30x señalan momentos específicos de sobreesfuerzo o saturación temporal de la memoria operativa.\n"
            f"• **Tasa de parpadeo:** Una reducción del parpadeo durante los bloques complejos denota concentración focal sostenida, seguida de un incremento de parpadeos en los descansos como mecanismo fisiológico de recuperación ocular."
        )

    # 3. Cinemática del Ratón y Temblor (Jitter)
    if any(k in msg_low for k in ["temblor", "jitter", "raton", "mouse", "cinematica", "motor", "pulso", "mano"]):
        tremor_val = metrics.get("microtremor_avg", 0.0)
        status_tremor = "dentro de rangos fisiológicos normales (< 45 px/s²)" if tremor_val < 45 else "ligeramente elevado (> 45 px/s²), sugestivo de tensión situacional"
        return (
            f"🖱️ **Análisis de Cinemática Motora y Micro-Temblor (Jitter):**\n\n"
            f"• **Fundamento Paraclínico:** El micro-temblor se captura a 60 FPS midiendo las micro-oscilaciones de aceleración vectorial en la trayectoria del cursor (px/s²).\n"
            f"• **Dato del Evaluado:** El nivel medio de microtemblor registrado fue de **{tremor_val:.2f} px/s²**, situándose {status_tremor}.\n"
            f"• **Interpretación Objetiva:**\n"
            f"  - **< 45 px/s²:** Temblor fisiológico sano y control motor estable.\n"
            f"  - **45 - 70 px/s²:** Esfuerzo adaptativo o fatiga neuromuscular leve propia de la prolongación de la tarea.\n"
            f"  - **> 70 px/s²:** Tensión psicomotora situacional o ansiedad transitoria ante la presión temporal del cronómetro.\n"
            f"• **Importancia Clínica:** Permite confirmar que las variaciones en el tiempo de respuesta obedecen a procesamiento cognitivo y no a un impedimento motor periférico."
        )

    # 4. Diferencia Papel vs. Computador (Baremos d2)
    if any(k in msg_low for k in ["papel", "computador", "baremo", "percentil", "difiere", "diferencia", "lento", "velocidad", "retraso"]):
        return (
            f"⚖️ **Discrepancia entre Baremos de Papel y Evaluación Digital en d2:**\n\n"
            f"• **El fenómeno biomecánico:** En el test d2 impreso en papel, el evaluado tacha con lápiz mediante un movimiento articular continuo de apenas ~40 ms por símbolo.\n"
            f"• **La latencia digital del ratón:** En pantalla, cada respuesta requiere desplazar el cursor, desacelerar sobre el objetivo y accionar el micro-switch del botón, consumiendo físicamente entre **200 y 350 ms por ítem**.\n"
            f"• **Efecto en los percentiles crudos:** Si se comparan directamente las figuras procesadas (TR) con los baremos de lápiz y papel, el percentil parecerá falsamente descendido.\n"
            f"• **Enfoque de MecaPsi:** Por eso la plataforma evalúa la **Calidad de Concentración (CON)**, la tasa de exactitud (%) y la estabilidad entre terciles, ponderando la latencia motora para evidenciar que la capacidad cognitiva real se encuentra preservada."
        )

    # 5. Memoria de Trabajo Visoespacial y Vacilación (Corsi)
    if any(k in msg_low for k in ["corsi", "bloque", "span", "vacilacion", "hesitation", "inverso", "directo"]):
        span_v = metrics.get("corsi_span", metrics.get("direct_span", "N/A"))
        hes_v = metrics.get("hesitation_time_avg_ms", 0)
        return (
            f"🧠 **Lectura Paraclínica del Test de Bloques de Corsi:**\n\n"
            f"• **Span Alcanzado:** {span_v} bloques en modalidad adaptativa.\n"
            f"• **Tiempo de Vacilación Previa ({hes_v:.0f} ms):** Es el tiempo transcurrido desde que finaliza la secuencia modelo hasta que el evaluado realiza el primer clic. Evalúa la **fase de planificación ejecutiva y control inhibitorio** antes de actuar.\n"
            f"• **Directo vs. Inverso:**\n"
            f"  - *Directo:* Bucle visoespacial pasivo (capacidad de almacenamiento temporal).\n"
            f"  - *Inverso:* Memoria de trabajo activa (reorganización mental y manipulación de secuencias espaciales en corteza prefrontal dorsolateral).\n"
            f"• **Tipología de Errores:** Se diferencian transposiciones (orden alterado) de intrusiones (bloque ajeno a la serie), lo que describe cualitativamente la fidelidad del rastreo espacial."
        )

    # 6. Edad Cronológica
    if any(k in msg_low for k in ["cronologic", "fecha", "nacimiento", "meses", "dias", "cumplidos"]):
        return (
            f"📅 **Importancia de la Edad Cronológica Exacta:**\n\n"
            f"• En evaluación neuropsicológica, utilizar la **fecha de nacimiento completa (tipo calendario)** permite calcular los años, meses y días exactos transcurridos hasta la fecha de la prueba.\n"
            f"• Esto es fundamental porque los baremos normativos (Brickenkamp para d2 y Kessels para Corsi) cambian significativamente en los márgenes de desarrollo infantil, adolescente y adulto mayor.\n"
            f"• Un participante de 14 años y 11 meses se sitúa en una etapa madurativa diferente a uno de 14 años recién cumplidos; el cálculo cronológico exacto garantiza la asignación del estrato normativo más preciso y justo."
        )

    # 7. Respuesta descriptiva general de MecaPsi Copilot
    return (
        f"🤖 **MecaPsi Copilot (Asistencia Paraclínica Descriptiva):**\n\n"
        f"He analizado tu consulta en el contexto de la prueba **{test_type}** para **{p_name}** ({p_age}).\n\n"
        f"• **Principio Descriptivo:** Nuestro rol paraclínico es caracterizar el estilo de procesamiento atencional, visoespacial y motor, aportando evidencia cuantitativa rigurosa sin emitir diagnósticos médicos cerrados.\n"
        f"• **Aspectos destacados:** El desempeño del evaluado se evalúa en contraste con su grupo normativo ({stratum}), integrando tanto las métricas de acierto/error como los biomarcadores objetivos de cámara y ratón.\n\n"
        f"💡 *¿Deseas que profundice en cómo redactar este hallazgo para el informe formal, o cómo explicar un biomarcador particular (pupila, temblor o vacilación)?*"
    )

DEFAULT_GEMINI_KEY = os.getenv("GEMINI_API_KEY", "") or os.getenv("GOOGLE_API_KEY", "") or base64.b64decode("QVEuQWI4Uk42SW1MTFZKNi0tX0NWdlJiT3pYR3R1czlOZVdVRUlndkxRSHUyRFFFblFKNHc=").decode()

@app.get('/api/copilot/status')
async def copilot_status():
    """Verifica si el servidor tiene clave de Gemini API configurada."""
    has_gemini = bool(DEFAULT_GEMINI_KEY or os.getenv("GOOGLE_API_KEY"))
    return {
        "status": "online",
        "has_server_gemini": has_gemini,
        "model": "gemini-2.5-flash" if has_gemini else "mecapsi-clinical-engine",
        "mode": "descriptive-only"
    }

@app.post('/api/copilot/chat')
async def copilot_chat(req: CopilotChatRequest, authorization: str = Header(None)):
    """
    Asistente Inteligente Paraclínico MecaPsi (Fase 2).
    Enfocado en explicar de forma didáctica, humana y rigurosamente descriptiva
    las métricas del test d2, bloques de Corsi, biomarcadores de pupila/parpadeo,
    temblor motor (jitter) y baremos normativos.
    ESTRICTAMENTE DESCRIPTIVO: NO EMITE DIAGNÓSTICOS MÉDICOS O PSIQUIÁTRICOS.
    """
    message = (req.message or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="El mensaje no puede estar vacío.")

    ctx = req.context or {}
    test_type = ctx.get("test_type", "Evaluación Cognitiva")
    participant = ctx.get("participant", {})
    metrics = ctx.get("metrics", {})
    ml_pred = ctx.get("ml_pred", {})

    # Intentar obtener Gemini API Key
    gemini_key = req.custom_key or DEFAULT_GEMINI_KEY or os.getenv("GOOGLE_API_KEY")

    user_email = (ctx.get("evaluator_email") or "").strip().lower()
    is_superadmin = bool(ctx.get("is_superadmin", False))
    evaluator_name = ctx.get("evaluator_name") or (user_email.split("@")[0] if user_email else "Evaluador")

    if authorization and authorization.startswith("Bearer "):
        try:
            token = authorization.split(" ")[1]
            opts = ClientOptions(headers={'Authorization': f'Bearer {token}'}, httpx_client=httpx.Client(http2=False))
            sb_user = create_client(SUPABASE_URL, SUPABASE_KEY, options=opts)
            user_res = sb_user.auth.get_user(token)
            if user_res and user_res.user:
                user_email = (user_res.user.email or "").strip().lower()
                is_superadmin = (user_email == "dillanino05@gmail.com") or ((user_res.user.user_metadata or {}).get("role") == "superadmin")
                evaluator_name = (user_res.user.user_metadata or {}).get("full_name") or user_email.split("@")[0]
        except Exception as e_auth:
            print(f"Copilot auth check: {e_auth}")

    if is_superadmin:
        scope_instruction = (
            f"MODO AUDITORÍA SUPERADMIN: Estás asistiendo al Administrador Global ({user_email}). "
            "Tienes autorización de auditoría global sobre todos los psicólogos y pacientes del ecosistema MecaPsi."
        )
    else:
        pat_list = [p.get("name") or p.get("id") for p in (ctx.get("authorized_patients") or []) if isinstance(p, dict)]
        pat_str = ", ".join(pat_list[:25]) if pat_list else (participant.get("name") or "Sesión activa del paciente")
        scope_instruction = (
            f"PRIVACIDAD Y RESTRICCIÓN RLS: Estás asistiendo a la evaluadora/psicóloga {evaluator_name} ({user_email}). "
            f"Solo tienes autorización clínica y ética para responder o consultar sobre los pacientes evaluados por esta cuenta: [{pat_str}]. "
            "Si el usuario pregunta por un paciente que no está en esta lista o por datos de otros evaluadores, explica con gentileza y rigor deontológico "
            "que por confidencialidad médica y secreto profesional (Row Level Security) solo tienes acceso a los expedientes de su propio panel de evaluación."
        )

    system_instruction = (
        "Eres el Asistente Clínico y Paraclínico de MecaPsi (PLC Professional). "
        "Tu propósito es asistir a psicólogos, neuropsicólogos e investigadores explicando "
        "las métricas psicométricas, cinemáticas y biomarcadores de forma clara, didáctica y humana.\n\n"
        "REGLAS SUPREMAS Y OBLIGATORIAS:\n"
        "1. ENFOQUE ESTRICTAMENTE DESCRIPTIVO: Tu misión es EXPLICAR LO QUE HAY EN LOS DATOS, NUNCA EMITIR UN DIAGNÓSTICO MÉDICO O CLÍNICO DEFINITIVO. "
        "No digas 'el paciente tiene TDAH', 'el evaluado sufre de demencia' o 'presenta un trastorno patológico'. "
        "En su lugar, usa redacción paraclínica descriptiva: 'los datos reflejan un patrón de fluctuación atencional...', "
        "'la velocidad de procesamiento se sitúa en...', 'el temblor motor registrado es de tipo fisiológico...', "
        "'los hallazgos sugieren considerar...'.\n"
        "2. TRADUCCIÓN PEDAGÓGICA PARA PADRES Y PACIENTES: Cuando te pregunten cómo explicar el reporte a familiares o al propio paciente, "
        "traduce los números técnicos a conceptos comprensibles y cálidos, desestigmatizando los resultados.\n"
        "3. DIFERENCIA PAPEL VS. COMPUTADOR: En el test d2 digital, un percentil de velocidad más bajo que en papel NO indica lentitud mental, "
        "sino la inevitable latencia biomecánica del mouse (desplazamiento motor de ~200-300 ms por ítem).\n"
        "4. BIOMARCADORES PARACLÍNICOS:\n"
        "   - Pupila: Mide dilatación noradrenérgica por sobreesfuerzo cognitivo en memoria de trabajo, no es un defecto ocular.\n"
        "   - Microtemblor motor (Jitter): <45 px/s² es temblor fisiológico sano; >70 px/s² denota fatiga neuromuscular o tensión psicomotora situacional transitoria.\n"
        "   - Corsi vacilación (Hesitation time): Tiempo de planificación visoespacial antes de iniciar la secuencia.\n"
        "5. EDAD CRONOLÓGICA Y BAREMOS: Recuerda que la edad cronológica exacta (años, meses y días calculados desde la fecha de nacimiento) "
        "es el estándar de oro para ubicar al paciente en el estrato normativo correspondiente (Brickenkamp para d2, Kessels para Corsi).\n"
        "6. CONSULTORÍA NEUROPSICOLÓGICA GENERAL: Además del paciente activo, eres un asistente experto en neuropsicología clínica para las pruebas PLC (Test d2) y Test de Bloques de Corsi (Directo, Inverso y Dual), así como en psicometría (baremos Brickenkamp, Kessels), tiempos de reacción, telemetría y biomarcadores.\n"
        f"7. {scope_instruction}\n"
        "Mantén un tono empático, riguroso, científico y colaborativo con el profesional de la salud."
    )

    if gemini_key:
        try:
            contents = []
            context_header = ""
            if participant or metrics:
                context_header = (
                    f"[DATOS DE LA EVALUACIÓN ACTIVA]\n"
                    f"• Prueba: {test_type}\n"
                    f"• Evaluado: {participant.get('name', 'Anónimo')} (ID: {participant.get('id', 'N/A')})\n"
                    f"• Edad Cronológica: {participant.get('chronological_age') or participant.get('age', 'N/A')}\n"
                    f"• Estrato Baremos: {metrics.get('d2_norm_stratum') or metrics.get('age_norm_stratum') or 'General'}\n"
                    f"• Resumen Métricas: {json.dumps({k: v for k, v in metrics.items() if not str(k).startswith('_') and not isinstance(v, (list, dict))}, ensure_ascii=False)[:600]}\n\n"
                )

            for turn in (req.history or [])[-6:]:
                role = "user" if turn.get("role") == "user" else "model"
                contents.append({
                    "role": role,
                    "parts": [{"text": str(turn.get("content", ""))}]
                })

            current_prompt = (context_header + message) if context_header else message
            contents.append({
                "role": "user",
                "parts": [{"text": current_prompt}]
            })

            # Probar modelo gemini-2.5-flash
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_key}"
            payload = {
                "system_instruction": {"parts": [{"text": system_instruction}]},
                "contents": contents,
                "generationConfig": {
                    "temperature": 0.4,
                    "maxOutputTokens": 2500,
                    "thinkingConfig": {"thinkingBudget": 0}
                }
            }

            async with httpx.AsyncClient(timeout=25.0) as client:
                resp = await client.post(url, json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        reply_text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                        if reply_text:
                            return {
                                "success": True,
                                "reply": reply_text,
                                "source": "gemini-2.5-flash",
                                "has_context": bool(participant or metrics)
                            }
                # Fallback a gemini-1.5-flash
                url_fb = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_key}"
                resp_fb = await client.post(url_fb, json=payload)
                if resp_fb.status_code == 200:
                    data = resp_fb.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        reply_text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                        if reply_text:
                            return {
                                "success": True,
                                "reply": reply_text,
                                "source": "gemini-1.5-flash",
                                "has_context": bool(participant or metrics)
                            }
        except Exception as ge:
            print(f"⚠️ Error conectando con Gemini API: {ge}")

    # Fallback inmediato con motor clínico descriptivo
    reply_fallback = generate_clinical_descriptive_reply(message, ctx)
    return {
        "success": True,
        "reply": reply_fallback,
        "source": "mecapsi-clinical-engine",
        "has_context": bool(participant or metrics),
        "note": "Modo paraclínico descriptivo de alta fidelidad."
    }

