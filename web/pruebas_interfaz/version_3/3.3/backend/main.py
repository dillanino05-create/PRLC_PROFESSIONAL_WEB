# ═══════════════════════════════════════════════════════
#  MecaPsi v3.3 — main.py
#  FastAPI Backend: Auth, Roles, Pacientes, Agenda, Tokens
# ═══════════════════════════════════════════════════════
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlmodel import Session, select
from typing import Optional, List
from datetime import datetime, timedelta
from pydantic import BaseModel
import hashlib, json, base64, hmac, time

from models import (
    create_tables, engine, hash_password,
    Usuario, Paciente, Nota, CitaAgenda, EvaluacionPLC, TokenConsumo
)

# ─── App Setup ─────────────────────────────────────────
app = FastAPI(
    title="MecaPsi v3.3 API",
    description="Backend clínico para plataforma SaaS neurocognitiva MecaPsi",
    version="3.3.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SECRET = "mecapsi_secret_key_2026_redcolsi"
security = HTTPBearer(auto_error=False)

@app.on_event("startup")
def on_startup():
    create_tables()
    # Auto-seed si DB vacía
    with Session(engine) as s:
        u = s.exec(select(Usuario)).first()
        if not u:
            import subprocess, sys
            subprocess.run([sys.executable, "seed.py"], cwd=".")

# ─── JWT Simple ────────────────────────────────────────
def create_token(payload: dict) -> str:
    payload["exp"] = int(time.time()) + 86400  # 24h
    data = base64.b64encode(json.dumps(payload).encode()).decode()
    sig  = hmac.new(SECRET.encode(), data.encode(), hashlib.sha256).hexdigest()
    return f"{data}.{sig}"

def decode_token(token: str) -> Optional[dict]:
    try:
        data, sig = token.rsplit(".", 1)
        expected = hmac.new(SECRET.encode(), data.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected):
            return None
        payload = json.loads(base64.b64decode(data).decode())
        if payload.get("exp", 0) < time.time():
            return None
        return payload
    except Exception:
        return None

def get_current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    if not creds:
        raise HTTPException(status_code=401, detail="Token requerido")
    payload = decode_token(creds.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")
    return payload

def get_db():
    with Session(engine) as session:
        yield session

# ─── Schemas ───────────────────────────────────────────
class LoginRequest(BaseModel):
    username: str
    password: str

class PacienteCreate(BaseModel):
    nombre: str
    edad: int
    genero: str
    motivo: Optional[str] = None

class NotaCreate(BaseModel):
    texto: str
    tipo: str = "Sesión"

class CitaCreate(BaseModel):
    paciente_nombre: str
    fecha: str
    hora: str
    tipo: str
    modalidad: str = "Presencial"
    color: str = "#2563eb"

class EvalCreate(BaseModel):
    paciente_id: int
    perfil_dss: str
    perfil_label: str
    confianza: float
    duracion_seg: int = 720

# ─── Auth ──────────────────────────────────────────────
@app.post("/api/auth/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    u = db.exec(select(Usuario).where(Usuario.username == req.username.lower())).first()
    if not u or u.password_hash != hash_password(req.password):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    
    token = create_token({"sub": u.id, "username": u.username, "role": u.role})
    return {
        "token": token,
        "user": {
            "id": u.id, "username": u.username, "role": u.role,
            "name": u.name, "initials": u.initials,
            "org": u.org, "org_code": u.org_code, "cargo": u.cargo,
            "plan": u.plan, "plan_vence": u.plan_vence,
            "tokens_disponibles": u.tokens_disponibles, "tokens_mes": u.tokens_mes
        }
    }

@app.get("/api/auth/me")
def me(payload=Depends(get_current_user), db: Session = Depends(get_db)):
    u = db.get(Usuario, payload["sub"])
    if not u:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return {
        "id": u.id, "username": u.username, "role": u.role,
        "name": u.name, "initials": u.initials,
        "org": u.org, "org_code": u.org_code, "cargo": u.cargo,
        "plan": u.plan, "plan_vence": u.plan_vence,
        "tokens_disponibles": u.tokens_disponibles, "tokens_mes": u.tokens_mes
    }

# ─── Pacientes ─────────────────────────────────────────
@app.get("/api/pacientes")
def get_pacientes(payload=Depends(get_current_user), db: Session = Depends(get_db)):
    if payload["role"] == "psicologo":
        pacs = db.exec(select(Paciente).where(Paciente.psicologo_id == payload["sub"])).all()
    else:
        pacs = db.exec(select(Paciente)).all()
    return [{"id": p.id, "codigo": p.codigo, "nombre": p.nombre, "edad": p.edad,
             "genero": p.genero, "motivo": p.motivo, "estado": p.estado, "created_at": p.created_at}
            for p in pacs]

@app.post("/api/pacientes")
def create_paciente(data: PacienteCreate, payload=Depends(get_current_user), db: Session = Depends(get_db)):
    count = len(db.exec(select(Paciente)).all())
    codigo = f"PAC-{count+1:04d}"
    p = Paciente(
        codigo=codigo, psicologo_id=payload["sub"],
        nombre=data.nombre, edad=data.edad, genero=data.genero, motivo=data.motivo
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return {"id": p.id, "codigo": p.codigo, "nombre": p.nombre}

# ─── Notas ─────────────────────────────────────────────
@app.get("/api/notas/{paciente_id}")
def get_notas(paciente_id: int, payload=Depends(get_current_user), db: Session = Depends(get_db)):
    notas = db.exec(select(Nota).where(Nota.paciente_id == paciente_id)).all()
    return [{"id": n.id, "texto": n.texto, "tipo": n.tipo, "fecha": n.fecha} for n in notas]

@app.post("/api/notas/{paciente_id}")
def create_nota(paciente_id: int, data: NotaCreate, payload=Depends(get_current_user), db: Session = Depends(get_db)):
    n = Nota(paciente_id=paciente_id, psicologo_id=payload["sub"], texto=data.texto, tipo=data.tipo)
    db.add(n)
    db.commit()
    db.refresh(n)
    return {"id": n.id, "texto": n.texto, "tipo": n.tipo, "fecha": n.fecha}

# ─── Agenda ────────────────────────────────────────────
@app.get("/api/agenda")
def get_agenda(payload=Depends(get_current_user), db: Session = Depends(get_db)):
    if payload["role"] == "psicologo":
        citas = db.exec(select(CitaAgenda).where(CitaAgenda.psicologo_id == payload["sub"])).all()
    else:
        citas = db.exec(select(CitaAgenda)).all()
    return [{"id": c.id, "paciente_nombre": c.paciente_nombre, "fecha": c.fecha,
             "hora": c.hora, "tipo": c.tipo, "modalidad": c.modalidad,
             "estado": c.estado, "color": c.color} for c in citas]

@app.post("/api/agenda")
def create_cita(data: CitaCreate, payload=Depends(get_current_user), db: Session = Depends(get_db)):
    c = CitaAgenda(psicologo_id=payload["sub"], **data.dict())
    db.add(c)
    db.commit()
    db.refresh(c)
    return {"id": c.id, "hora": c.hora, "tipo": c.tipo, "estado": c.estado}

# ─── Tokens ────────────────────────────────────────────
@app.get("/api/tokens")
def get_tokens(payload=Depends(get_current_user), db: Session = Depends(get_db)):
    u = db.get(Usuario, payload["sub"])
    consumos = db.exec(select(TokenConsumo).where(TokenConsumo.user_id == payload["sub"])).all()
    return {
        "disponibles": u.tokens_disponibles,
        "mes": u.tokens_mes,
        "consumidos": u.tokens_mes - u.tokens_disponibles,
        "historial": [{"prueba": t.prueba, "timestamp": t.timestamp} for t in consumos[-10:]]
    }

@app.post("/api/tokens/consume")
def consume_token(payload=Depends(get_current_user), db: Session = Depends(get_db)):
    u = db.get(Usuario, payload["sub"])
    if u.tokens_disponibles <= 0:
        raise HTTPException(status_code=402, detail="Sin tokens disponibles. Actualiza tu plan.")
    u.tokens_disponibles -= 1
    t = TokenConsumo(user_id=u.id, prueba="PLC v3")
    db.add(t)
    db.add(u)
    db.commit()
    return {"tokens_disponibles": u.tokens_disponibles, "mensaje": "Token consumido correctamente"}

# ─── Evaluaciones ───────────────────────────────────────
@app.post("/api/evaluaciones")
def create_eval(data: EvalCreate, payload=Depends(get_current_user), db: Session = Depends(get_db)):
    e = EvaluacionPLC(psicologo_id=payload["sub"], **data.dict())
    db.add(e)
    db.commit()
    db.refresh(e)
    return {"id": e.id, "perfil_dss": e.perfil_dss, "confianza": e.confianza}

@app.get("/api/evaluaciones/{paciente_id}")
def get_evals(paciente_id: int, payload=Depends(get_current_user), db: Session = Depends(get_db)):
    evals = db.exec(select(EvaluacionPLC).where(EvaluacionPLC.paciente_id == paciente_id)).all()
    return [{"id": e.id, "perfil_dss": e.perfil_dss, "perfil_label": e.perfil_label,
             "confianza": e.confianza, "timestamp": e.timestamp} for e in evals]

# ─── Admin: Métricas Globales ───────────────────────────
@app.get("/api/admin/metrics")
def admin_metrics(payload=Depends(get_current_user), db: Session = Depends(get_db)):
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Acceso solo Admin")
    total_usuarios = len(db.exec(select(Usuario)).all())
    total_pacientes = len(db.exec(select(Paciente)).all())
    total_evals = len(db.exec(select(EvaluacionPLC)).all())
    total_tokens_consumidos = len(db.exec(select(TokenConsumo)).all())
    users = db.exec(select(Usuario).where(Usuario.role == "psicologo")).all()
    return {
        "total_usuarios": total_usuarios,
        "total_pacientes": total_pacientes,
        "total_evaluaciones": total_evals,
        "total_tokens_consumidos": total_tokens_consumidos,
        "especialistas": [
            {"id": u.id, "name": u.name, "org": u.org, "plan": u.plan,
             "tokens_disponibles": u.tokens_disponibles, "tokens_mes": u.tokens_mes}
            for u in users
        ]
    }

@app.get("/api/admin/usuarios")
def admin_usuarios(payload=Depends(get_current_user), db: Session = Depends(get_db)):
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Acceso solo Admin")
    return [{"id": u.id, "username": u.username, "name": u.name, "role": u.role,
             "org": u.org, "plan": u.plan, "tokens_disponibles": u.tokens_disponibles}
            for u in db.exec(select(Usuario)).all()]

@app.get("/")
def root():
    return {"message": "MecaPsi v3.3 API — Sistema de Soporte a la Decisión Clínica", "status": "online", "version": "3.3.0"}
