from pydantic import BaseModel
from typing import List, Optional, Dict, Any


class LineData(BaseModel):
    linea: int = 1
    targets_total: int = 0
    aciertos: int = 0
    omisiones: int = 0
    comisiones: int = 0
    evaluados: int = 0          # Cuántos estímulos evaluó el paciente en esa línea
    tiempo_s: float = 0.0
    tiempo_pct: float = 0.0
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
    # ── Módulo Corsi: Telemetría de Ensayo Visoespacial ───────────────────────
    sequence_length: Optional[int] = None
    attempt: Optional[int] = None
    sequence_presented: Optional[List[int]] = None
    sequence_user: Optional[List[int]] = None
    success: Optional[bool] = None
    hesitation_time_ms: Optional[float] = None
    mean_reaction_time_ms: Optional[float] = None



class ClickLogItem(BaseModel):
    line: Optional[int] = 1
    stim_idx: Optional[int] = 0
    is_target: Optional[bool] = False
    stim_key: Optional[str] = ""
    action: Optional[str] = "click"
    elapsed_ms: Optional[int] = 0
    # ── Módulo Corsi: Clics sobre Cubos 3D ─────────────────────────────────────
    cube_id: Optional[int] = None
    sequence_position: Optional[int] = None
    expected_cube: Optional[int] = None
    is_correct: Optional[bool] = None
    reaction_time_ms: Optional[float] = None
    distance_px: Optional[float] = None
    x_coord: Optional[float] = None
    y_coord: Optional[float] = None



class ParticipantInfo(BaseModel):
    id: str
    name: str
    age: int
    gender: str
    education: str
    hand: str
    occupation: str = ""



class PredictRequest(BaseModel):
    test_type: Optional[str] = "PLC"
    age: int = 25
    education: str = "Universitario"
    hand: str = "Derecha"
    TN: Optional[int] = 0
    TA: Optional[int] = 0
    O: Optional[int] = 0
    C: Optional[int] = 0
    total_time: Optional[float] = 0.0
    cv_time: Optional[float] = 0.0
    fatigue_hits: Optional[float] = 0.0
    consistency: Optional[float] = 0.0
    block_hits: Optional[List[int]] = None
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
    # ── Módulo Corsi ──────────────────────────────────────────────────────────
    corsi_span: Optional[int] = None
    corsi_mode: Optional[str] = None
    max_level: Optional[int] = None
    total_trials: Optional[int] = None
    correct_trials: Optional[int] = None
    error_trials: Optional[int] = None
    accuracy_pct: Optional[float] = None
    mean_reaction_time_ms: Optional[float] = None
    hesitation_time_avg_ms: Optional[float] = None
    composite_score: Optional[float] = None
    transposition_count: Optional[int] = None
    intrusion_count: Optional[int] = None
    transposition_rate: Optional[float] = None
    intrusion_rate: Optional[float] = None
    euclidean_error_dist: Optional[float] = None
    kessels_norm_mean: Optional[float] = None
    kessels_z_score: Optional[float] = None
    kessels_percentile: Optional[int] = None
    perseveration_rate: Optional[float] = None
    first_error_level: Optional[float] = None
    first_attempt_pass_rate: Optional[float] = None
    mean_iti_ms: Optional[float] = None
    iti_cv: Optional[float] = None
    latency_slope: Optional[float] = None
    model_config = {"extra": "allow"}



class MetricsData(BaseModel):
    # ── Métricas Específicas PLC (Test d2) con valores por defecto ─────────────
    TA: Optional[int] = 0
    O: Optional[int] = 0
    COM: Optional[int] = 0
    TN: Optional[int] = 0
    TOT: Optional[int] = 0
    CON: Optional[int] = 0
    CP: Optional[float] = 0.0
    totalTime: Optional[float] = 0.0
    meanTpl: Optional[float] = 0.0
    stdTpl: Optional[float] = 0.0
    cvTime: Optional[float] = 0.0
    procSpeed: Optional[float] = 0.0
    efficiency: Optional[float] = 0.0
    FA: Optional[float] = 0.0
    GQ: Optional[float] = 0.0
    VAR: Optional[float] = 0.0
    estabilidad: Optional[float] = 0.0
    consistency: Optional[float] = 0.0
    TRM: Optional[float] = 0.0
    IVR: Optional[float] = 0.0
    blockHits: Optional[List[int]] = None
    errorPat: Optional[int] = 0
    adjScore: Optional[float] = 0.0
    meanRt: Optional[float] = 0.0
    medRt: Optional[float] = 0.0
    attnStyle: Optional[str] = ""
    attnDesc: Optional[str] = ""
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
    # ── Módulo Corsi: Memoria de Trabajo Visoespacial ────────────────────────
    corsi_span: Optional[int] = None
    corsi_mode: Optional[str] = None
    max_level: Optional[int] = None
    total_trials: Optional[int] = None
    correct_trials: Optional[int] = None
    error_trials: Optional[int] = None
    accuracy_pct: Optional[float] = None
    hesitation_time_avg_ms: Optional[float] = None
    mean_reaction_time_ms: Optional[float] = None
    composite_score: Optional[int] = None
    clinical_category: Optional[str] = None
    clinical_desc: Optional[str] = None
    trials_data: Optional[List[Dict[str, Any]]] = None
    transposition_count: Optional[int] = None
    intrusion_count: Optional[int] = None
    transposition_rate: Optional[float] = None
    intrusion_rate: Optional[float] = None
    euclidean_error_dist: Optional[float] = None
    kessels_norm_mean: Optional[float] = None
    kessels_z_score: Optional[float] = None
    kessels_percentile: Optional[int] = None
    # ── Identidad Multi-Test y Cadena de Custodia Digital ─────────────────────
    test_type: Optional[str] = "PLC"
    session_tag: Optional[str] = None
    session_uid: Optional[str] = None
    # ── Blindaje e Integridad Paraclínica (Anti-Cheat) ─────────────────────────
    integrity_audit: Optional[Dict[str, Any]] = None
    model_config = {"extra": "allow"}



class SaveRequest(BaseModel):
    test_type: Optional[str] = "PLC"
    session_uid: Optional[str] = None
    participant: ParticipantInfo
    lines_data: List[LineData]
    click_log: List[ClickLogItem]
    metrics: MetricsData
    ml_prediction: Optional[Dict[str, Any]] = None
    narrative: str = ""
    client_session_id: Optional[str] = None
    exam_token: Optional[str] = None

