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
    microtremor_score: float = 0.0 # Amplitud de microtemblor instantáneo
    sweep_regularity: float = 100.0 # Regularidad de avance izquierda a derecha (%)
    retrocesos_mouse: int = 0   # Rectificaciones bruscas hacia atrás
    # ── Biomarcadores Oculomotores y Emocionales (MediaPipe Face Mesh) ─────────
    ear_avg: Optional[float] = None # Eye Aspect Ratio promedio en la línea
    blinks_count: Optional[int] = None # Conteo de parpadeos en la línea
    gaze_diverted: Optional[bool] = None # Desvío de mirada detectado fuera del canvas
    fer_expression: Optional[str] = None # Expresión/tensión facial observada en la línea
    # ── Pupilometría Cognitiva y Carga Mental (MediaPipe Iris) ────────────────
    pupil_dilation_avg: Optional[float] = None # Dilatación relativa normalizada vs reposo (ej. 1.15 = +15%)



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
    # ── Biomarcadores Oculomotores y Conductuales ──────────────────────────────
    camera_active: Optional[bool] = False
    ear_mean: Optional[float] = None
    blink_count: Optional[int] = None
    blink_rate_min: Optional[float] = None
    gaze_diverted_count: Optional[int] = None
    gaze_diverted_ms: Optional[float] = None
    microtremor_avg: Optional[float] = None
    sweep_regularity_avg: Optional[float] = None
    # ── Expresiones Faciales y Tensión (FER) ──────────────────────────────────
    fer_dominant: Optional[str] = None
    fer_tension_score: Optional[float] = None
    fer_frustration_events: Optional[int] = None
    # ── Pupilometría Cognitiva y Carga Mental (MediaPipe Iris) ────────────────
    pupil_dilation_avg: Optional[float] = None
    cognitive_load_peaks: Optional[int] = None


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
    # ── Biomarcadores Digitales y Oculomotores agregados ───────────────────────
    tremor_lines: Optional[List[int]] = None   # Nº de páginas con tremor detectado
    camera_active: Optional[bool] = False
    ear_mean: Optional[float] = None
    blink_count: Optional[int] = None
    blink_rate_min: Optional[float] = None
    gaze_diverted_count: Optional[int] = None
    gaze_diverted_ms: Optional[float] = None
    microtremor_avg: Optional[float] = None
    sweep_regularity_avg: Optional[float] = None
    video_path: Optional[str] = None
    # ── Expresiones Faciales y Tensión (FER) ──────────────────────────────────
    fer_dominant: Optional[str] = None
    fer_tension_score: Optional[float] = None
    fer_frustration_events: Optional[int] = None
    # ── Pupilometría Cognitiva y Carga Mental (MediaPipe Iris) ────────────────
    pupil_dilation_avg: Optional[float] = None # Dilatación pupilar relativa media (vs reposo)
    cognitive_load_peaks: Optional[int] = None # Conteo de sobreesfuerzos (>120% dilatación basal por >300ms)
    pupil_baseline: Optional[float] = None     # Línea base en reposo calibrada
    # ── Identidad Multi-Test y Cadena de Custodia Digital ─────────────────────
    test_type: Optional[str] = "PLC"
    session_tag: Optional[str] = None
    session_uid: Optional[str] = None



class SaveRequest(BaseModel):
    test_type: Optional[str] = "PLC"
    session_uid: Optional[str] = None
    participant: ParticipantInfo
    lines_data: List[LineData]
    click_log: List[ClickLogItem]
    metrics: MetricsData
    ml_prediction: Optional[Dict[str, Any]] = None
    narrative: str = ""
