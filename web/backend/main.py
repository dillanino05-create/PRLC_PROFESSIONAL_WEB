import os
from pathlib import Path
from datetime import datetime

from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from supabase import create_client, Client, ClientOptions

from .models import PredictRequest, SaveRequest
from .predictor import predictor
from .excel_export import save_excel, EXPORTS_DIR

# ── Paths ──────────────────────────────────────────────────────────────────────
WEB_DIR      = Path(__file__).parent.parent
FRONTEND_DIR = WEB_DIR / 'frontend'

app = FastAPI(title='PLC Professional Web', version='2.0')

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Supabase Setup ─────────────────────────────────────────────────────────────
SUPABASE_URL = "https://lfyaiwbtfgoiczyyzlwh.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmeWFpd2J0ZmdvaWN6eXl6bHdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNjc1MTEsImV4cCI6MjA5MDY0MzUxMX0.ZfVceXuYWQKEZimgRLt9kGkSGpq8FO7kRgKbL-Ta-3M"

def get_supabase(authorization: str = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Falta autorización/Ingresa de nuevo")
    
    token = authorization.split(" ")[1]
    
    # Cliente configurado para actuar en nombre del psicólogo logueado (Respetando RLS)
    opts = ClientOptions(headers={'Authorization': f'Bearer {token}'})
    sb = create_client(SUPABASE_URL, SUPABASE_KEY, options=opts)
    
    # Verificación del usuario contra Supabase Auth
    res = sb.auth.get_user(token)
    if not res or not res.user:
         raise HTTPException(status_code=401, detail="Usuario inválido")
         
    return {"client": sb, "user_id": res.user.id}

# ── Archivos Estáticos ─────────────────────────────────────────────────────────
app.mount('/static', StaticFiles(directory=str(FRONTEND_DIR)), name='static')

@app.get('/')
def root():
    return FileResponse(str(FRONTEND_DIR / 'index.html'))

@app.get('/api/status')
def status():
    return {'model_available': predictor.available, 'version': '2.0'}

@app.post('/api/predict')
def predict(req: PredictRequest):
    return predictor.predict(req.model_dump())

@app.post('/api/save')
def save(req: SaveRequest, auth_ctx: dict = Depends(get_supabase)):
    sb = auth_ctx["client"]
    uid = auth_ctx["user_id"]
    try:
        part      = req.participant.model_dump()
        metrics   = req.metrics.model_dump()
        lines     = [l.model_dump() for l in req.lines_data]
        clicks    = [c.model_dump() for c in req.click_log]
        ml_pred   = req.ml_prediction
        narrative = req.narrative

        # Generar Excel en disco local TEMPORAL
        excel_path = save_excel(part, lines, clicks, metrics, ml_pred, narrative)
        filename = os.path.basename(excel_path)
        
        # Guardar a la nube (Supabase Storage)
        with open(excel_path, "rb") as f:
            sb.storage.from_("exports").upload(
                path=filename, 
                file=f, 
                file_options={"content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}
            )
            
        # Curación de datos: Eliminar Excel local ahora que está seguro en la nube
        try: os.remove(excel_path)
        except: pass

        # Centralizar historial de pacientes en Supabase Database (con RLS protegido)
        row_data = {
            "user_id": uid,
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
            "excel_path": filename
        }
        
        res = sb.table("evaluations").insert(row_data).execute()
        eval_id = res.data[0]["id"]

        return {'id': eval_id, 'excel_filename': filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get('/api/export/{eval_id}')
def export(eval_id: int, auth_ctx: dict = Depends(get_supabase)):
    sb = auth_ctx["client"]
    res = sb.table("evaluations").select("excel_path").eq("id", eval_id).execute()
    if not res.data or not res.data[0].get("excel_path"):
        raise HTTPException(status_code=404, detail="Archivo no encontrado en base de datos")
        
    filename = res.data[0]["excel_path"]
    public_url = sb.storage.from_("exports").get_public_url(filename)
    return {"url": public_url}

@app.get('/api/history')
def history(auth_ctx: dict = Depends(get_supabase)):
    sb = auth_ctx["client"]
    try:
        # Extrae de forma segura el historial vinculado por RLS.
        res = sb.table("evaluations").select(
            "id, created_at, participant_id, participant_name, age, metrics_json"
        ).order("id", desc=True).execute()
        
        result = []
        for r in res.data:
            m = r.get("metrics_json", {})
            result.append({
                'id': r['id'],
                'created_at': r['created_at'],
                'participant_id': r['participant_id'],
                'participant_name': r['participant_name'],
                'age': r['age'],
                'CP': round(m.get('CP', 0), 1) if 'CP' in m else 0,
                'TA': m.get('TA', 0),
            })
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete('/api/history/{eval_id}')
def delete_eval(eval_id: int, auth_ctx: dict = Depends(get_supabase)):
    sb = auth_ctx["client"]
    
    # 1. Recuperar path y borrar excel en la nube
    res = sb.table("evaluations").select("excel_path").eq("id", eval_id).execute()
    if res.data and res.data[0].get("excel_path"):
        filename = res.data[0]["excel_path"]
        sb.storage.from_("exports").remove([filename])
            
    # 2. Borrar del registro base de datos
    sb.table("evaluations").delete().eq("id", eval_id).execute()
    return {'ok': True}
