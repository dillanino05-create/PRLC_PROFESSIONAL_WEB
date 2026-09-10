from pydantic import BaseModel
from typing import List, Optional, Dict, Any


class LineData(BaseModel):
    linea: int
    targets_total: int
    aciertos: int
    omisiones: int
    comisiones: int
    evaluados: int = 0          # Cuántos estímulos evaluó el paciente en esa línea
    tiempo_s: float
    tiempo_pct: float
    saltos_erraticos: int = 0
    # ── Biomarcadores Digitales: Cinemática del Cursor ──────────────────────────
    tremor_score: float = 0.0   # Índice de variabilidad cinemática (Jitter)
    tremor_flag: bool = False    # True si supera el umbral clínico de alerta


class ClickLogItem(BaseModel):
    line: int
    stim_idx: int
    is_target: bool
    stim_key: str
    action: str
    elapsed_ms: int


class ParticipantInfo(BaseModel):
    id: str
    name: str
    age: int
    gender: str
    education: str
    hand: str
    occupation: str = ""


class PredictRequest(BaseModel):
    age: int
    education: str
    hand: str
    TN: int
    TA: int
    O: int
    C: int
    total_time: float
    cv_time: float
    fatigue_hits: float
    consistency: float
    block_hits: List[int]


class MetricsData(BaseModel):
    TA: int
    O: int
    COM: int
    TN: int
    TOT: int
    CON: int
    CP: float
    totalTime: float
    meanTpl: float
    stdTpl: float
    cvTime: float
    procSpeed: float
    efficiency: float
    FA: float
    GQ: float
    VAR: float
    estabilidad: float
    consistency: float
    TRM: float
    IVR: float
    blockHits: List[int]
    errorPat: int
    adjScore: float
    meanRt: float
    medRt: float
    attnStyle: str
    attnDesc: str
    # ── Campos de estado que el frontend ya enviaba pero faltaban en el modelo ──
    focusType: str = ""
    isIncomplete: bool = False
    lastLine: int = 0
    lastChar: int = 0
    # ── Biomarcadores Digitales agregados ──────────────────────────────────────
    tremor_lines: Optional[List[int]] = None   # Nº de páginas con tremor detectado


class SaveRequest(BaseModel):
    participant: ParticipantInfo
    lines_data: List[LineData]
    click_log: List[ClickLogItem]
    metrics: MetricsData
    ml_prediction: Optional[Dict[str, Any]] = None
    narrative: str = ""
