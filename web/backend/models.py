from pydantic import BaseModel
from typing import List, Optional, Dict, Any


class LineData(BaseModel):
    linea: int
    targets_total: int
    aciertos: int
    omisiones: int
    comisiones: int
    tiempo_s: float
    tiempo_pct: float
    saltos_erraticos: int = 0


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


class SaveRequest(BaseModel):
    participant: ParticipantInfo
    lines_data: List[LineData]
    click_log: List[ClickLogItem]
    metrics: MetricsData
    ml_prediction: Optional[Dict[str, Any]] = None
    narrative: str = ""
