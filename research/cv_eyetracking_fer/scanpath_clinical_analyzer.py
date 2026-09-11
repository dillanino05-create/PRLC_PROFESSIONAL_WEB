"""
Analizador de Barrido Visual (Scanpath) y Motor de Banderas Rojas Clínicas
PLC Professional · MecaPsi Cognitive Systems

Algoritmos:
1. I-VT Filter (Velocity-Threshold Identification) para clasificar Fijaciones vs. Sacadas
2. Analizador de Regresión Sacádica y Salto de Líneas (Line Drift & Line Skip)
3. Fusión Multimodal Temporal (Oculometría + FER + Cinemática del Mouse)
4. Generador de Alertas Clínicas Objetivas (Red Flags) para el Psicólogo
"""

import math
import json
import os
from typing import List, Dict, Any, Tuple
import numpy as np

class ScanpathClinicalAnalyzer:
    def __init__(self, screen_width: int = 1920, screen_height: int = 1080):
        self.width = screen_width
        self.height = screen_height
        
        # Umbrales psicofisiológicos estándar (Salvucci & Goldberg, 2000)
        self.VELOCITY_SACCADE_THRESH = 300.0  # px/s (> 300 px/s es movimiento sacádico)
        self.MIN_FIXATION_DURATION_MS = 100.0 # < 100 ms no cuenta como fijación cognitiva consciente
        self.MAX_FIXATION_DURATION_MS = 1400.0 # > 1400 ms indica "bloqueo", duda o freezing
        self.MAX_REGRESSIVE_VELOCITY = -150.0 # px/s hacia atrás (de derecha a izquierda)
        
    def filter_ivt(self, samples: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Algoritmo I-VT (Velocity-Threshold Identification).
        Separa la serie temporal de mirada en Fijaciones (donde se procesa información) y Sacadas (saltos visuales).
        """
        if len(samples) < 2:
            return [], []
            
        fixations = []
        saccades = []
        
        current_fixation_points = []
        current_fix_start_t = samples[0]["timestamp_ms"]
        
        for i in range(1, len(samples)):
            p0 = samples[i - 1]["gaze"]
            p1 = samples[i]["gaze"]
            t0 = samples[i - 1]["timestamp_ms"]
            t1 = samples[i]["timestamp_ms"]
            
            dt_s = (t1 - t0) / 1000.0
            if dt_s <= 0:
                continue
                
            dx = p1["screen_x"] - p0["screen_x"]
            dy = p1["screen_y"] - p0["screen_y"]
            dist_px = math.sqrt(dx * dx + dy * dy)
            velocity = dist_px / dt_s
            
            if velocity < self.VELOCITY_SACCADE_THRESH:
                # Es fijación visual
                current_fixation_points.append(samples[i])
            else:
                # Es sacada (movimiento rápido)
                saccades.append({
                    "start_t": t0,
                    "end_t": t1,
                    "duration_ms": t1 - t0,
                    "from_x": p0["screen_x"],
                    "from_y": p0["screen_y"],
                    "to_x": p1["screen_x"],
                    "to_y": p1["screen_y"],
                    "dx": dx,
                    "dy": dy,
                    "is_regressive": dx < 0 and abs(dx) > 60, # Salto hacia la izquierda
                    "velocity_px_s": velocity
                })
                
                # Cerrar fijación acumulada anterior si cumple duración mínima
                if len(current_fixation_points) > 0:
                    fix_end_t = current_fixation_points[-1]["timestamp_ms"]
                    fix_dur = fix_end_t - current_fix_start_t
                    if fix_dur >= self.MIN_FIXATION_DURATION_MS:
                        xs = [pt["gaze"]["screen_x"] for pt in current_fixation_points]
                        ys = [pt["gaze"]["screen_y"] for pt in current_fixation_points]
                        fixations.append({
                            "start_t": current_fix_start_t,
                            "end_t": fix_end_t,
                            "duration_ms": fix_dur,
                            "centroid_x": float(np.mean(xs)),
                            "centroid_y": float(np.mean(ys)),
                            "dispersion_px": float(np.std(xs) + np.std(ys)),
                            "line_index": current_fixation_points[0].get("line_index", 0),
                            "affect_snapshot": current_fixation_points[-1].get("affect", {})
                        })
                    current_fixation_points = []
                    current_fix_start_t = t1
                    
        # Última fijación
        if len(current_fixation_points) > 0:
            fix_end_t = current_fixation_points[-1]["timestamp_ms"]
            fix_dur = fix_end_t - current_fix_start_t
            if fix_dur >= self.MIN_FIXATION_DURATION_MS:
                xs = [pt["gaze"]["screen_x"] for pt in current_fixation_points]
                ys = [pt["gaze"]["screen_y"] for pt in current_fixation_points]
                fixations.append({
                    "start_t": current_fix_start_t,
                    "end_t": fix_end_t,
                    "duration_ms": fix_dur,
                    "centroid_x": float(np.mean(xs)),
                    "centroid_y": float(np.mean(ys)),
                    "dispersion_px": float(np.std(xs) + np.std(ys)),
                    "line_index": current_fixation_points[0].get("line_index", 0),
                    "affect_snapshot": current_fixation_points[-1].get("affect", {})
                })
                
        return fixations, saccades

    def analyze_session(self, session_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Ejecuta el análisis clínico integral sobre la sesión grabada:
        1. Métricas de Barrido Visual (Scanpath)
        2. Métricas Afectivas (FER)
        3. Detección de Banderas Rojas y Marcadores de Alerta
        """
        samples = session_data.get("samples", [])
        motor_events = session_data.get("motor_events", [])
        
        if not samples:
            return {"error": "Sin datos de telemetria de mirada"}
            
        fixations, saccades = self.filter_ivt(samples)
        
        total_time_s = (samples[-1]["timestamp_ms"] - samples[0]["timestamp_ms"]) / 1000.0
        
        # 1. Métricas de Oculometría
        total_fixations = len(fixations)
        total_saccades = len(saccades)
        regressive_saccades = [s for s in saccades if s.get("is_regressive", False)]
        regressive_rate = (len(regressive_saccades) / total_saccades * 100.0) if total_saccades > 0 else 0.0
        
        avg_fixation_duration = float(np.mean([f["duration_ms"] for f in fixations])) if fixations else 0.0
        max_fixation_duration = float(np.max([f["duration_ms"] for f in fixations])) if fixations else 0.0
        
        # 2. Análisis de Salto de Líneas (Line Drift / Line Skipping)
        line_mismatches = 0
        line_dwell_times = {}
        for s in samples:
            target_line = s.get("line_index", 0)
            est_line = s["gaze"].get("estimated_line", target_line)
            if est_line != target_line:
                line_mismatches += 1
            line_dwell_times[est_line] = line_dwell_times.get(est_line, 0) + 1
            
        line_drift_percentage = (line_mismatches / len(samples) * 100.0) if samples else 0.0
        
        # 3. Métricas de Afecto y Microexpresiones (FER)
        affect_counts = {"neutral": 0, "anxiety": 0, "frustration": 0, "surprise_alert": 0}
        au4_intensities = []
        ear_values = []
        blink_count = 0
        in_blink = False
        
        for s in samples:
            aff = s.get("affect", {})
            dom = aff.get("dominant", "neutral")
            if dom in affect_counts:
                affect_counts[dom] += 1
                
            pupil = s.get("pupillometry", {})
            ear = (pupil.get("ear_left", 0.28) + pupil.get("ear_right", 0.28)) / 2.0
            ear_values.append(ear)
            
            if ear < 0.20 and not in_blink:
                blink_count += 1
                in_blink = True
            elif ear >= 0.20:
                in_blink = False
                
        blink_rate_per_min = (blink_count / (total_time_s / 60.0)) if total_time_s > 0 else 0.0
        
        # 4. Motor de Banderas Rojas Clínicas (Red Flags Engine)
        red_flags = []
        
        # Flag A: Salto Errático de Líneas (Desorganización visuoespacial)
        if line_drift_percentage > 18.0:
            red_flags.append({
                "code": "RF_SCANPATH_LINE_DRIFT",
                "severity": "ALTA" if line_drift_percentage > 30.0 else "MEDIA",
                "titulo": "Disorganizacion del Barrido Visual (Salto de Lineas)",
                "evidencia": f"El paciente desvio su foco visual de la linea activa el {line_drift_percentage:.1f}% del tiempo.",
                "hipotesis_clinica": "Posible debilidad en planificacion visuoespacial, rastreo sacadico erratico o dificultad de rastreo secuencial (comun en TDAH o fatiga visual)."
            })
            
        # Flag B: Tasa Anomala de Regresiones Sacadicas
        if regressive_rate > 22.0:
            red_flags.append({
                "code": "RF_EXCESSIVE_REGRESSIONS",
                "severity": "MEDIA",
                "titulo": "Elevada Tasa de Regresiones Sacadicas",
                "evidencia": f"{regressive_rate:.1f}% de las sacadas se dirigieron hacia atras (de derecha a izquierda).",
                "hipotesis_clinica": "Verificacion compulsiva constante, desconfianza atencional o perdida de la memoria de trabajo inmediata sobre la posicion del estimulo."
            })
            
        # Flag C: Bloqueo Cognitivo con Ansiedad (Anxious Freezing)
        anxious_freezes = [
            f for f in fixations 
            if f["duration_ms"] > 1600.0 and f.get("affect_snapshot", {}).get("dominant") == "anxiety"
        ]
        if len(anxious_freezes) > 0:
            red_flags.append({
                "code": "RF_ANXIOUS_FREEZING",
                "severity": "ALTA",
                "titulo": "Episodio de Bloqueo Cognitivo con Tensión Afectiva",
                "evidencia": f"Se detectaron {len(anxious_freezes)} fijaciones prolongadas (>1.6 s) con expresion facial de ansiedad/hipervigilancia.",
                "hipotesis_clinica": "Indica inhibicion motora transitoria mediada por ansiedad ante la evaluacion ('bloqueo por presion temporal')."
            })
            
        # Flag D: Impulsividad Frustrada (Error de comision seguido de ceño fruncido inmediato)
        # Correlacion temporal entre clics erroneos y microexpresion facial
        impulsive_frustration_events = 0
        for ev in motor_events:
            if ev.get("action") == "CLICK_DISTRACTOR" or not ev.get("is_correct", True):
                click_t = ev.get("timestamp_ms", 0)
                # Buscar muestras en los 500 ms posteriores al clic erroneo
                post_click_samples = [
                    s for s in samples 
                    if 0 <= (s["timestamp_ms"] - click_t) <= 550
                ]
                for s in post_click_samples:
                    if s.get("affect", {}).get("dominant") == "frustration":
                        impulsive_frustration_events += 1
                        break
                        
        if impulsive_frustration_events > 0:
            red_flags.append({
                "code": "RF_IMPULSIVE_ERROR_AWARENESS",
                "severity": "MEDIA",
                "titulo": "Fallo Inhibitorio con Conciencia Inmediata de Error",
                "evidencia": f"{impulsive_frustration_events} clics en distractores desencadenaron microexpresiones inmediatas de frustracion (<500 ms).",
                "hipotesis_clinica": "El sujeto posee el criterio discriminativo del estimulo pero padece de urgencia motora (falla en el freno inhibitorio motor mas que en el reconocimiento visual)."
            })
            
        # Flag E: Fatiga Atencional / Decaimiento de la Vigilancia
        if blink_rate_per_min > 28.0 or avg_fixation_duration > 700.0:
            red_flags.append({
                "code": "RF_ATTENTION_FATIGUE",
                "severity": "BAJA",
                "titulo": "Indicadores de Sobreesfuerzo o Fatiga Cognitiva",
                "evidencia": f"Frecuencia de parpadeo elevada ({blink_rate_per_min:.1f} parpadeos/min) y tiempo medio de fijacion de {avg_fixation_duration:.0f} ms.",
                "hipotesis_clinica": "Sobreesfuerzo compensatorio para mantener la atencion sostenida ante decaimiento de energia psicomotora."
            })
            
        return {
            "session_summary": {
                "duration_s": round(total_time_s, 2),
                "total_samples": len(samples),
                "fps_promedio": round(len(samples) / total_time_s, 1) if total_time_s > 0 else 0
            },
            "oculomotor_metrics": {
                "total_fixations": total_fixations,
                "avg_fixation_duration_ms": round(avg_fixation_duration, 1),
                "max_fixation_duration_ms": round(max_fixation_duration, 1),
                "total_saccades": total_saccades,
                "regressive_saccades_count": len(regressive_saccades),
                "regressive_rate_percent": round(regressive_rate, 2),
                "line_drift_percent": round(line_drift_percentage, 2)
            },
            "affective_metrics": {
                "affect_distribution_percent": {
                    k: round(v / len(samples) * 100.0, 1) for k, v in affect_counts.items()
                },
                "blink_count": blink_count,
                "blink_rate_per_min": round(blink_rate_per_min, 1),
                "mean_ear": round(float(np.mean(ear_values)), 3) if ear_values else 0.28
            },
            "clinical_red_flags": red_flags
        }

if __name__ == "__main__":
    print("[MecaPsi] Validando Motor de Analisis de Scanpath y Banderas Rojas...")
    analyzer = ScanpathClinicalAnalyzer()
    
    # Simular una serie de 300 muestras (10 segundos de prueba a 30 FPS)
    simulated_samples = []
    t = 0
    for i in range(300):
        # Simular lectura lineal con una regresion y un salto de linea en i=120
        x = (i * 12) % 1200 + 100
        y = 250 if i < 120 else (380 if i < 180 else 250) # Salto de linea momentaneo
        est_line = 1 if i < 120 else (2 if i < 180 else 1)
        
        dominant_affect = "neutral"
        if 130 <= i <= 170:
            dominant_affect = "anxiety" # Ansiedad durante el desvio
        elif i >= 260:
            dominant_affect = "frustration"
            
        simulated_samples.append({
            "timestamp_ms": t,
            "line_index": 1,
            "gaze": {
                "screen_x": x + np.random.normal(0, 5),
                "screen_y": y + np.random.normal(0, 5),
                "estimated_line": est_line,
                "confidence": 0.94
            },
            "pupillometry": {
                "ear_left": 0.27,
                "ear_right": 0.27,
                "blink_active": False
            },
            "affect": {
                "dominant": dominant_affect,
                "scores": {"neutral": 0.7, "anxiety": 0.2, "frustration": 0.1}
            }
        })
        t += 33 # ~30 fps
        
    motor_events = [
        {"timestamp_ms": 8500, "action": "CLICK_DISTRACTOR", "stim_id": "D3", "is_correct": False}
    ]
    
    report = analyzer.analyze_session({"samples": simulated_samples, "motor_events": motor_events})
    print("\n--- REPORTE DE TELEMETRIA Y BANDERAS ROJAS GENERADO ---")
    print(json.dumps(report, indent=2))
