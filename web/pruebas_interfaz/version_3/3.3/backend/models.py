# ═══════════════════════════════════════════════════════
#  MecaPsi v3.3 — models.py
#  Modelos de base de datos con SQLModel
# ═══════════════════════════════════════════════════════
from typing import Optional, List
from datetime import datetime
from sqlmodel import Field, SQLModel, create_engine, Session, select
import hashlib

DATABASE_URL = "sqlite:///./mecapsi.db"
engine = create_engine(DATABASE_URL, echo=False)

# ─── Modelos ───────────────────────────────────────────

class Usuario(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(unique=True, index=True)
    password_hash: str
    role: str  # 'admin' | 'psicologo'
    name: str
    initials: str
    org: str
    org_code: str
    cargo: str
    plan: Optional[str] = None          # 'oro' | 'plata' | 'bronce' (solo psicólogos)
    plan_vence: Optional[str] = None
    tokens_disponibles: int = 50
    tokens_mes: int = 50                # límite mensual

class Paciente(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    codigo: str = Field(unique=True, index=True)   # PAC-XXXX
    nombre: str
    edad: int
    genero: str
    motivo: Optional[str] = None
    psicologo_id: int = Field(foreign_key="usuario.id")
    estado: str = "Activo"
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())

class Nota(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    paciente_id: int = Field(foreign_key="paciente.id")
    psicologo_id: int = Field(foreign_key="usuario.id")
    texto: str
    tipo: str = "Sesión"   # 'Sesión' | 'Evaluación' | 'Seguimiento' | 'Observación'
    fecha: str = Field(default_factory=lambda: datetime.now().strftime("%d %b, %Y"))
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat())

class CitaAgenda(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    paciente_nombre: str
    psicologo_id: int = Field(foreign_key="usuario.id")
    fecha: str
    hora: str
    tipo: str
    modalidad: str = "Presencial"
    estado: str = "Confirmada"
    color: str = "var(--primary-vivid)"

class EvaluacionPLC(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    paciente_id: int = Field(foreign_key="paciente.id")
    psicologo_id: int = Field(foreign_key="usuario.id")
    perfil_dss: str       # 'dss-p0' ... 'dss-p7'
    perfil_label: str
    confianza: float
    duracion_seg: int = 720
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat())

class TokenConsumo(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="usuario.id")
    prueba: str = "PLC v3"
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat())

# ─── Helpers ───────────────────────────────────────────

def hash_password(pwd: str) -> str:
    return hashlib.sha256(pwd.encode()).hexdigest()

def create_tables():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
