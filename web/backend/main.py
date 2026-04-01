import os
import sqlite3
import json
from pathlib import Path
from datetime import datetime
from typing import Any, Dict

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

from .models import PredictRequest, SaveRequest
from .predictor import predictor
from .excel_export import save_excel, EXPORTS_DIR

# ── Paths ──────────────────────────────────────────────────────────────────────
WEB_DIR      = Path(__file__).parent.parent
FRONTEND_DIR = WEB_DIR / 'frontend'
DATA_DIR     = WEB_DIR / 'data'
DATA_DIR.mkdir(exist_ok=True)
DB_PATH      = DATA_DIR / 'plc.db'

# ── FastAPI app ────────────────────────────────────────────────────────────────
app = FastAPI(title='PLC Professional Web', version='1.0')

# ── SQLite setup ───────────────────────────────────────────────────────────────
def get_db():
    con = sqlite3.connect(str(DB_PATH))
    con.row_factory = sqlite3.Row
    return con

def init_db():
    con = get_db()
    con.execute('''CREATE TABLE IF NOT EXISTS evaluations (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at    TEXT,
        participant_id TEXT,
        participant_name TEXT,
        age           INTEGER,
        gender        TEXT,
        education     TEXT,
        hand          TEXT,
        occupation    TEXT,
        metrics_json  TEXT,
        ml_json       TEXT,
        lines_json    TEXT,
        clicks_json   TEXT,
        narrative     TEXT,
        excel_path    TEXT
    )''')
    con.commit(); con.close()

init_db()

# ── Static files ───────────────────────────────────────────────────────────────
app.mount('/static', StaticFiles(directory=str(FRONTEND_DIR)), name='static')

# ── Routes ─────────────────────────────────────────────────────────────────────
@app.get('/')
def root():
    return FileResponse(str(FRONTEND_DIR / 'index.html'))

@app.get('/api/status')
def status():
    return {
        'model_available': predictor.available,
        'version': '1.0'
    }

@app.post('/api/predict')
def predict(req: PredictRequest):
    result = predictor.predict(req.model_dump())
    return result

@app.post('/api/save')
def save(req: SaveRequest):
    try:
        part      = req.participant.model_dump()
        metrics   = req.metrics.model_dump()
        lines     = [l.model_dump() for l in req.lines_data]
        clicks    = [c.model_dump() for c in req.click_log]
        ml_pred   = req.ml_prediction
        narrative = req.narrative

        # Generate Excel
        excel_path = save_excel(part, lines, clicks, metrics, ml_pred, narrative)

        # Save to SQLite
        con = get_db()
        cur = con.execute('''INSERT INTO evaluations
            (created_at, participant_id, participant_name, age, gender, education, hand, occupation,
             metrics_json, ml_json, lines_json, clicks_json, narrative, excel_path)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)''', (
            datetime.now().isoformat(),
            part['id'], part['name'], part['age'], part['gender'],
            part['education'], part['hand'], part.get('occupation',''),
            json.dumps(metrics), json.dumps(ml_pred),
            json.dumps(lines), json.dumps(clicks),
            narrative, excel_path
        ))
        eval_id = cur.lastrowid
        con.commit(); con.close()

        return {'id': eval_id, 'excel_filename': os.path.basename(excel_path)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get('/api/export/{eval_id}')
def export(eval_id: int):
    con = get_db()
    row = con.execute('SELECT excel_path FROM evaluations WHERE id=?', (eval_id,)).fetchone()
    con.close()
    if not row or not row['excel_path']:
        raise HTTPException(status_code=404, detail='Archivo no encontrado')
    fp = row['excel_path']
    if not os.path.exists(fp):
        raise HTTPException(status_code=404, detail='Archivo Excel no existe en disco')
    return FileResponse(fp, media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                        filename=os.path.basename(fp))

@app.get('/api/history')
def history():
    con = get_db()
    rows = con.execute(
        'SELECT id, created_at, participant_id, participant_name, age, metrics_json '
        'FROM evaluations ORDER BY id DESC'
    ).fetchall()
    con.close()
    result = []
    for r in rows:
        m = json.loads(r['metrics_json'] or '{}')
        result.append({
            'id': r['id'],
            'created_at': r['created_at'],
            'participant_id': r['participant_id'],
            'participant_name': r['participant_name'],
            'age': r['age'],
            'CP': round(m.get('CP', 0), 1),
            'TA': m.get('TA', 0),
        })
    return result

@app.delete('/api/history/{eval_id}')
def delete_eval(eval_id: int):
    con = get_db()
    row = con.execute('SELECT excel_path FROM evaluations WHERE id=?', (eval_id,)).fetchone()
    if row and row['excel_path'] and os.path.exists(row['excel_path']):
        try: os.remove(row['excel_path'])
        except: pass
    con.execute('DELETE FROM evaluations WHERE id=?', (eval_id,))
    con.commit(); con.close()
    return {'ok': True}
