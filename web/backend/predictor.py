import os
import numpy as np

try:
    from tensorflow.keras.models import load_model
    import joblib
    TF_AVAILABLE = True
except ImportError:
    TF_AVAILABLE = False

# Model files live in the parent PLC_Professional directory
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class PLCMLPredictor:
    PROFILES = {
        0: {'key': 'Base_Normativa',    'nombre': 'Rendimiento Base Normativo',
            'desc': 'Se observa un patrón de respuesta que cursa dentro de los límites de expectativa por tiempo y aciertos. Relación TA-Comisiones sin sesgos unilaterales.',
            'rasgos': ['Métricas dentro de la varianza estadística esperada', 'Tasa O/C sin inclinación',
                       'Estabilidad lograda entre el primer y segundo segmento temporal']},
        1: {'key': 'Latencia_Omision',  'nombre': 'Latencia de Respuesta con Omisión',
            'desc': 'El procesamiento de estímulos cursa con tiempo dilatado en relación a la muestra base. Fuerte prevalencia de O sobre C.',
            'rasgos': ['Volumen de omisiones superior al volumen de comisiones', 'Métrica de velocidad ubicada en percentil bajo', 'Respuesta rítmica demorada']},
        2: {'key': 'Pico_Reactivo',     'nombre': 'Alta Reactividad Específica (Comisión Elevada)',
            'desc': 'Mayor volumen de respuesta total con menor filtro discriminativo. El sujeto interactuó rápidamente pero seleccionó blancos distractores.',
            'rasgos': ['Tasa de comisiones supera la varianza esperada', 'Menor latencia de reconocimiento temporal',
                       'Priorización sistémica de marcado vs exactitud visual']},
        3: {'key': 'Varianza_Alta',     'nombre': 'Varianza Bilateral',
            'desc': 'Ausencia de tendencia marcada hacia O o C. Altas tasas cruzadas en ambos espectros de falla con desequilibrio cronológico.',
            'rasgos': ['Volúmenes densos simultáneos en O y C', 'Varianza de latencia (TRM) inestable',
                       'Picos de inconsistencia intra-bloque']},
        4: {'key': 'Desempeno_Decrescente','nombre': 'Desempeño Decrescente (Fase Final)',
            'desc': 'Procesamiento óptimo cronométrico y exacto en primer segmento (L1-L7), con marcado declive estadístico residual en fase L10-L14.',
            'rasgos': ['Restricción a la monotonía en curva negativa', 'Masa cruda de O/C agrupada al final',
                       'Aumento aritmético progresivo en latencia por línea final']},
        5: {'key': 'Latencia_Sostenida','nombre': 'Latencia Larga Sostenida',
            'desc': 'Rendimiento rítmico lento y estable de inicio a fin.',
            'rasgos': ['Latencia bruta plana y extendida', 'Sin alteraciones de bloque significativas',
                       'CP% sostenido a costa de baja velocidad']},
        6: {'key': 'Alta_Eficiencia',   'nombre': 'Alta Eficiencia de Rastreo',
            'desc': 'Patrón donde convergen la velocidad de reacción alta y el rastreo exacto. Muy baja carga de fallas O/C.',
            'rasgos': ['CP% superior al parámetro standard central', 'Mínima fluctuación de respuesta', 'Rastreo sostenido exitoso']},
        7: {'key': 'Latencia_Estricta', 'nombre': 'Restricción de Respuesta y Alta Latencia',
            'desc': 'Disminución marcada del volumen de clics totales mitigando matemáticamente las comisiones a cifras mínimas.',
            'rasgos': ['Tasa de Comisiones cercana a nulo', 'Frecuencia de respuesta drásticamente diluida',
                       'Ausencia de incremento de velocidad longitudinal']},
    }

    def __init__(self):
        self.model = None
        self.scaler = None
        self.available = False
        self._load()

    def _load(self):
        if not TF_AVAILABLE:
            return
        mp = os.path.join(BASE_DIR, 'd2_mlp_model_v3.keras')
        sp = os.path.join(BASE_DIR, 'd2_scaler_v3.joblib')
        try:
            if os.path.exists(mp):
                self.model = load_model(mp)
                print(f'[OK] MLP cargado desde {mp}')
        except Exception as e:
            print(f'[WARN] Model error: {e}')
        try:
            if os.path.exists(sp):
                self.scaler = joblib.load(sp)
                print(f'[OK] Scaler cargado')
        except Exception as e:
            print(f'[WARN] Scaler error: {e}')
        self.available = self.model is not None

    def predict(self, data: dict) -> dict:
        if not self.available:
            return {'model_used': False, 'error': 'Modelo no disponible'}
        try:
            age = data.get('age', 25)
            TN  = data.get('TN', 100)
            TA  = data.get('TA', 80)
            O   = data.get('O', 0)
            C   = data.get('C', 0)
            TOT = O + C
            CON = data.get('CON', max(0, TA - C))
            CP  = data.get('CP', (CON / TN * 100) if TN > 0 else 0)
            tt  = data.get('total_time', 280)
            mtl = tt / 14
            cv  = data.get('cv_time', 10)
            ps  = (47 * 14 / tt) * 60 if tt > 0 else 0
            eff = (TA / tt) * 60 if tt > 0 else 0
            FA  = TA / tt if tt > 0 else 0
            GQ  = (TA ** 2) / (TN * tt) if TN > 0 and tt > 0 else 0
            fh  = data.get('fatigue_hits', 0)
            cr  = data.get('consistency', 10)
            bh  = data.get('block_hits', [TA // 5] * 5)
            if len(bh) < 5: bh = [TA // 5] * 5
            or_ = (O / TN * 100) if TN > 0 else 0
            comr= (C / TN * 100) if TN > 0 else 0
            acc = (TA / TN * 100) if TN > 0 else 0
            ep  = 1 if O > C * 2.5 else 2 if C > O * 2.5 else 3 if O > C else 4 if C > O else 5
            af  = 0.92 if age < 18 else 0.85 if age > 60 else 0.95 if age > 45 else 1.0
            edu = data.get('education', 'Universitario')
            hand= data.get('hand', 'Derecha')
            feat = [age, TN, TA, O, C, TOT, CON, CP, tt, mtl, cv, ps, eff, FA, GQ, fh, cr,
                    bh[0], bh[1], bh[2], bh[3], bh[4], or_, comr, acc, ep, CP * af,
                    1 if edu == 'Primaria' else 0,
                    1 if edu == 'Secundaria' else 0,
                    1 if edu == 'Universitario' else 0,
                    1 if hand == 'Derecha' else 0,
                    1 if hand == 'Izquierda' else 0]
            X = np.array([feat])
            if self.scaler:
                X = self.scaler.transform(X)
            probs = self.model.predict(X, verbose=0)[0]
            pc   = int(np.argmax(probs))
            conf = float(probs[pc])
            info = self.PROFILES.get(pc, self.PROFILES[0])

            # ── Procesamiento de Biomarcadores Oculomotores y Conductuales ─────
            camera_active = bool(data.get('camera_active', False))
            ear_mean = data.get('ear_mean')
            try:
                ear_mean = float(ear_mean) if ear_mean is not None else None
            except (ValueError, TypeError):
                ear_mean = None

            try:
                blink_count = int(data.get('blink_count') or 0)
            except (ValueError, TypeError):
                blink_count = 0

            try:
                blink_rate_min = float(data.get('blink_rate_min') or 0.0)
            except (ValueError, TypeError):
                blink_rate_min = 0.0

            try:
                gaze_diverted_count = int(data.get('gaze_diverted_count') or 0)
            except (ValueError, TypeError):
                gaze_diverted_count = 0

            try:
                gaze_diverted_ms = float(data.get('gaze_diverted_ms') or 0.0)
            except (ValueError, TypeError):
                gaze_diverted_ms = 0.0

            try:
                microtremor_avg = float(data.get('microtremor_avg') or 0.0)
            except (ValueError, TypeError):
                microtremor_avg = 0.0

            try:
                sweep_raw = data.get('sweep_regularity_avg')
                sweep_regularity_avg = float(sweep_raw) if sweep_raw is not None else 100.0
            except (ValueError, TypeError):
                sweep_regularity_avg = 100.0

            try:
                fer_dominant = str(data.get('fer_dominant') or 'Concentración Neutra')
            except Exception:
                fer_dominant = 'Concentración Neutra'

            try:
                fer_tension_score = float(data.get('fer_tension_score') or 0.0)
            except Exception:
                fer_tension_score = 0.0

            try:
                fer_frustration_events = int(data.get('fer_frustration_events') or 0)
            except Exception:
                fer_frustration_events = 0

            biomarkers_summary = {
                'camera_active': camera_active,
                'oculomotor': {
                    'ear_mean': ear_mean,
                    'blink_count': blink_count,
                    'blink_rate_min': blink_rate_min,
                    'gaze_diverted_count': gaze_diverted_count,
                    'gaze_diverted_ms': gaze_diverted_ms,
                    'status': 'Foco Sostenido' if gaze_diverted_count <= 2 else 'Fluctuación / Desvíos Frecuentes'
                } if camera_active else {'status': 'Cámara Desactivada por el Usuario'},
                'facial_emotions': {
                    'dominant_expression': fer_dominant,
                    'tension_score': fer_tension_score,
                    'frustration_events': fer_frustration_events,
                    'status': 'Tensión Facial / Sobreesfuerzo' if fer_tension_score > 60.0 else 'Foco Atencional Sereno'
                } if camera_active else {'status': 'Cámara Desactivada por el Usuario'},
                'motor_kinematics': {
                    'microtremor_avg': microtremor_avg,
                    'sweep_regularity_avg': sweep_regularity_avg,
                    'status': 'Estabilidad Normal' if (microtremor_avg <= 85.0 and sweep_regularity_avg >= 80.0) else 'Tensión / Barrido Irregular'
                }
            }

            return {
                'model_used': True,
                'predicted_code': pc,
                'predicted_profile': info['key'],
                'confidence': conf,
                'confidence_percent': f'{conf * 100:.1f}%',
                'profile_info': info,
                'all_probs': {self.PROFILES[i]['key']: float(p) for i, p in enumerate(probs)},
                'biomarkers_summary': biomarkers_summary
            }
        except Exception as e:
            return {'model_used': False, 'error': str(e)}


class CorsiMLPredictor:
    """
    Predictor de Perfiles Clínicos para el Test de Bloques de Corsi (CBT).
    Basado en el marco neuropsicológico de Baddeley (Bucle Visoespacial vs Ejecutivo Central)
    y los baremos normativos estandarizados de Kessels et al. (2000, 2008) y Berch et al. (1998).
    Estructurado sobre un Vector de 32 Características biométricas y cronométricas.
    """
    PROFILES = {
        0: {
            'key': 'Normativo_Tipico',
            'nombre': 'Rendimiento Normativo Típico',
            'desc': 'Amplitud de memoria de trabajo visoespacial dentro de la norma poblacional esperada para el grupo etario. Capacidad funcional adecuada para retener y secuenciar información espacial tanto en modalidad pasiva como ejecutiva.',
            'rasgos': [
                'Span visoespacial dentro del rango típico normativo (Kessels et al., 2000)',
                'Latencias de inicio (duda táctica) y ejecución rítmicas estables',
                'Ausencia de discrepancia crítica entre modalidades directa e inversa'
            ],
            'risk': 'Bajo'
        },
        1: {
            'key': 'Disociacion_Ejecutiva_Frontal',
            'nombre': 'Disociación Ejecutiva Visoespacial (Disfunción Frontal DLPFC)',
            'desc': 'Marcada discrepancia entre el bucle pasivo (Span Directo preservado) y la memoria de trabajo activa (Span Inverso deficiente con caída >= 2 cubos). Señal patognomónica de sobrecosto en manipulación mental y control ejecutivo frontoparietal.',
            'rasgos': [
                'Span directo adecuado frente a colapso significativo en modalidad inversa',
                'Tiempo de vacilación inicial (IRT) excesivamente prolongado en inversión',
                'Frecuentes errores de transposición secuencial en secuencias de carga media'
            ],
            'risk': 'Moderado - Alto'
        },
        2: {
            'key': 'Deficit_Almacenamiento_Primario',
            'nombre': 'Déficit de Almacenamiento Primario (Compromiso Parieto-Occipital)',
            'desc': 'Descenso simétrico tanto en modalidad directa como inversa (Span <= 3 o 4). Incapacidad para retener el mapa espacial inmediato independientemente de la demanda ejecutiva, sugestivo de compromiso en la red dorsal visoespacial.',
            'rasgos': [
                'Span restringido desde los niveles basales de la prueba',
                'Errores tempranos de intrusión (toque de bloques no iluminados)',
                'Bajo puntaje de consistencia Kessels (Block-Product Score descendido)'
            ],
            'risk': 'Alto'
        },
        3: {
            'key': 'Fatiga_Agotamiento_Cognitivo',
            'nombre': 'Fatiga y Agotamiento Cognitivo Progresivo',
            'desc': 'Ejecución inicial adecuada y precisa en los primeros niveles, seguida de una degradación abrupta en la retención secuencial y aumento súbito de vacilaciones y dilatación pupilar ante fatiga acumulada.',
            'rasgos': [
                'Declive no lineal del rendimiento a medida que avanzan los ensayos',
                'Incremento exponencial de latencias y pausas motoras en niveles avanzados',
                'Picos transitorios de sobreesfuerzo pupilar y tensión gestual (FER)'
            ],
            'risk': 'Moderado'
        },
        4: {
            'key': 'Impulsividad_Visomotora',
            'nombre': 'Impulsividad Visomotora y Desinhibición',
            'desc': 'Latencias de planificación extremadamente cortas (IRT < 300 ms) con toques apresurados y erráticos. El sujeto inicia la respuesta antes de consolidar el trazo espacial, cometiendo errores evitables por falta de control inhibitorio.',
            'rasgos': [
                'Tiempo de duda táctica casi inexistente antes del primer contacto',
                'Alta velocidad de clic con frecuentes errores de orden y perseveraciones',
                'Micro-temblor motor acelerado en la trayectoria del cursor'
            ],
            'risk': 'Moderado'
        },
        5: {
            'key': 'Bradipsiquia_Enlentecimiento',
            'nombre': 'Lentificación Cognitivo-Motora / Bradipsiquia',
            'desc': 'Secuenciación exacta y preservación de la precisión a expensas de tiempos de reacción y vacilación extremadamente dilatados. Refleja lentificación en la velocidad de procesamiento central o excesiva cautela psicomotora.',
            'rasgos': [
                'Latencias de reacción inter-bloque (ITI) sustancialmente por encima de la media',
                'Tiempo de duda táctica prolongado previo al primer movimiento',
                'Mantenimiento de alta precisión a expensas de un costo temporal elevado'
            ],
            'risk': 'Moderado - Bajo'
        }
    }

    def __init__(self):
        self.model = None
        self.scaler = None
        self.available = False
        self._load()

    def _load(self):
        if not TF_AVAILABLE:
            return
        mp = os.path.join(BASE_DIR, 'corsi_mlp_model_v1.keras')
        sp = os.path.join(BASE_DIR, 'corsi_scaler_v1.joblib')
        try:
            if os.path.exists(mp):
                self.model = load_model(mp)
                print(f'[OK] Modelo Corsi MLP cargado desde {mp}')
        except Exception as e:
            print(f'[WARN] Corsi Model error: {e}')
        try:
            if os.path.exists(sp):
                self.scaler = joblib.load(sp)
                print(f'[OK] Corsi Scaler cargado')
        except Exception as e:
            print(f'[WARN] Corsi Scaler error: {e}')
        self.available = self.model is not None

    def extract_features(self, data: dict) -> list:
        """Extrae el Vector Estandarizado de 32 Características de Corsi."""
        age = float(data.get('age', 30))
        span = float(data.get('corsi_span', 5))
        max_lvl = float(data.get('max_level', span))
        tot_trials = float(data.get('total_trials', 6))
        corr_trials = float(data.get('correct_trials', 5))
        err_trials = float(data.get('error_trials', max(0, tot_trials - corr_trials)))
        acc_pct = float(data.get('accuracy_pct', (corr_trials / max(tot_trials, 1)) * 100))
        composite = float(data.get('composite_score', span * corr_trials))
        mean_rt = float(data.get('mean_reaction_time_ms', 1200))
        hesitation = float(data.get('hesitation_time_avg_ms', 800))
        tot_time = float(data.get('total_time_sec', 60))
        is_reverse = 1.0 if str(data.get('corsi_mode', 'direct')).lower() == 'reverse' else 0.0

        # Esperanza normativa de Kessels por edad
        expected_span = 5.6 if age < 40 else 5.2 if age < 60 else 4.6
        if is_reverse:
            expected_span -= 0.6
        span_dev = span - expected_span
        block_product = span * corr_trials

        transp_rate = float(data.get('transposition_rate', 0.0))
        intrusion_rate = float(data.get('intrusion_rate', 0.0))
        euclidean_err = float(data.get('euclidean_error_dist', 0.0))
        perseveration = float(data.get('perseveration_rate', 0.0))
        first_err_lvl = float(data.get('first_error_level', span + 1))
        first_pass_rate = float(data.get('first_attempt_pass_rate', 75.0))
        mean_iti = float(data.get('mean_iti_ms', mean_rt))
        iti_cv = float(data.get('iti_cv', 18.0))
        lat_slope = float(data.get('latency_slope', 45.0))

        tremor = float(data.get('microtremor_avg', 0.0))
        sweep_reg = float(data.get('sweep_regularity_avg', 100.0))
        pupil = float(data.get('pupil_dilation_avg', 1.0))
        load_peaks = float(data.get('cognitive_load_peaks', 0))
        blink_rate = float(data.get('blink_rate_min', 15.0))
        fer_tens = float(data.get('fer_tension_score', 0.0))
        fer_frust = float(data.get('fer_frustration_events', 0))
        focus_lost = float(data.get('focus_lost_count', 0))

        feat = [
            (age - 6.0) / 79.0,  # 1. edad_norm
            1.0 if data.get('hand', 'Derecha') == 'Derecha' else -1.0 if data.get('hand') == 'Izquierda' else 0.0, # 2. lateralidad
            span,                 # 3. span
            max_lvl,              # 4. max_level
            tot_trials,           # 5. total_trials
            corr_trials,          # 6. correct_trials
            err_trials,           # 7. error_trials
            acc_pct,              # 8. accuracy_pct
            composite,            # 9. composite_score
            mean_rt,              # 10. mean_rt
            hesitation,           # 11. hesitation
            tot_time,             # 12. total_time
            is_reverse,           # 13. is_reverse
            span_dev,             # 14. span_dev_kessels
            block_product,        # 15. block_product
            transp_rate,          # 16. transposition_rate
            intrusion_rate,       # 17. intrusion_rate
            euclidean_err,        # 18. euclidean_err
            perseveration,        # 19. perseveration
            first_err_lvl,        # 20. first_error_level
            first_pass_rate,      # 21. first_attempt_pass_rate
            mean_iti,             # 22. mean_iti
            iti_cv,               # 23. iti_cv
            lat_slope,            # 24. latency_slope
            tremor,               # 25. tremor
            sweep_reg,            # 26. sweep_regularity
            pupil,                # 27. pupil
            load_peaks,           # 28. load_peaks
            blink_rate,           # 29. blink_rate
            fer_tens,             # 30. fer_tension
            fer_frust,            # 31. fer_frustration
            focus_lost            # 32. focus_lost
        ]
        return feat

    def predict(self, data: dict) -> dict:
        """Inferencia de perfil clínico neuropsicológico para Corsi."""
        try:
            feat = self.extract_features(data)
            span = feat[2]
            acc_pct = feat[7]
            hesitation = feat[10]
            mean_rt = feat[9]
            is_reverse = bool(feat[12] > 0.5)
            span_dev = feat[13]
            expected_span = round(span - span_dev, 1)
            load_peaks = feat[27]
            fer_tens = feat[29]
            tremor = feat[24]

            # Inferencia de Probabilidades de Perfiles (Calibración Bayesiana / Heurística)
            logits = np.zeros(6, dtype=float)

            # P0: Normativo Típico (Span >= 5, precisión >= 70%, tiempos fisiológicos)
            if span >= 5 and acc_pct >= 65 and 350 <= hesitation <= 1600:
                logits[0] += 3.5 + (span - 5) * 0.8
            else:
                logits[0] += 0.5

            # P1: Disociación Ejecutiva Visoespacial (Inverso deficiente, alto vacilamiento)
            if is_reverse:
                if span <= 4 or span_dev <= -1.2:
                    logits[1] += 4.2 + max(0, 4 - span) * 1.2
                if hesitation > 1400:
                    logits[1] += 1.5
            else:
                # Si se aportó discrepancia explícita
                discrepancy = float(data.get('span_discrepancy', 0))
                if discrepancy >= 2:
                    logits[1] += 3.8

            # P2: Déficit de Almacenamiento Primario (Span <= 3 o 4 tanto directo como inverso)
            if span <= 3:
                logits[2] += 4.8 + (3 - span) * 1.5
            elif span == 4 and acc_pct < 60:
                logits[2] += 2.5

            # P3: Fatiga / Agotamiento Cognitivo (Carga pupilar alta, picos de frustración)
            if load_peaks >= 2 or fer_tens > 35.0:
                logits[3] += 2.8 + min(load_peaks, 4) * 0.5
            if acc_pct < 70 and span >= 4:
                logits[3] += 1.2

            # P4: Impulsividad Visomotora (Vacilación mínima < 350ms, velocidad alta con fallos)
            if hesitation < 350 and acc_pct < 85:
                logits[4] += 4.0 + (350 - hesitation) / 100.0
            if tremor > 85.0:
                logits[4] += 1.0

            # P5: Bradipsiquia / Lentificación (Muy lento pero preciso)
            if hesitation > 1800 or mean_rt > 1700:
                logits[5] += 3.2
                if acc_pct >= 75:
                    logits[5] += 1.5

            # Softmax
            exp_l = np.exp(logits - np.max(logits))
            probs = exp_l / np.sum(exp_l)

            # Si el modelo Keras está disponible, usarlo
            if self.available and self.model is not None:
                try:
                    X = np.array([feat])
                    if self.scaler:
                        X = self.scaler.transform(X)
                    probs = self.model.predict(X, verbose=0)[0]
                except Exception as ml_err:
                    print(f'[WARN] Keras Corsi inference error: {ml_err}')

            pc = int(np.argmax(probs))
            conf = float(probs[pc])
            info = self.PROFILES.get(pc, self.PROFILES[0])

            # Biomarcadores paraclínicos
            camera_active = bool(data.get('camera_active', False))
            biomarkers_summary = {
                'camera_active': camera_active,
                'oculomotor': {
                    'blink_rate_min': float(data.get('blink_rate_min', 0.0)),
                    'status': 'Fijación Ocular Sostenida'
                } if camera_active else {'status': 'Cámara Desactivada'},
                'facial_emotions': {
                    'tension_score': fer_tens,
                    'frustration_events': int(data.get('fer_frustration_events', 0)),
                    'status': 'Tensión Facial / Sobreesfuerzo' if fer_tens > 40.0 else 'Serenidad Gestual'
                } if camera_active else {'status': 'Cámara Desactivada'},
                'motor_kinematics': {
                    'microtremor_avg': tremor,
                    'sweep_regularity_avg': float(data.get('sweep_regularity_avg', 100.0)),
                    'status': 'Estabilidad Normal' if tremor <= 85.0 else 'Tensión / Micro-temblor Elevado'
                },
                'pupillometry': {
                    'pupil_dilation_avg': float(data.get('pupil_dilation_avg', 1.0)),
                    'cognitive_load_peaks': int(load_peaks),
                    'status': f'{int(load_peaks)} Picos de Carga Mental' if load_peaks > 0 else 'Carga Pupilar Estable'
                } if camera_active else {'status': 'Cámara Desactivada'}
            }

            return {
                'model_used': True,
                'engine': 'Keras MLP' if (self.available and self.model) else 'Algoritmo Paramétrico Normativo Corsi (Kessels)',
                'test_type': 'CORSI',
                'predicted_code': pc,
                'predicted_profile': info['key'],
                'confidence': conf,
                'confidence_percent': f'{conf * 100:.1f}%',
                'profile_info': info,
                'all_probs': {self.PROFILES[i]['key']: float(p) for i, p in enumerate(probs)},
                'biomarkers_summary': biomarkers_summary,
                'corsi_metrics': {
                    'span': span,
                    'mode': 'Inversa' if is_reverse else 'Directa',
                    'composite_score': feat[8],
                    'accuracy_pct': acc_pct,
                    'hesitation_avg_ms': hesitation,
                    'mean_rt_ms': mean_rt,
                    'expected_span_kessels': expected_span,
                    'span_deviation': round(span_dev, 2)
                }
            }
        except Exception as e:
            return {'model_used': False, 'test_type': 'CORSI', 'error': str(e)}


# Singletons
predictor = PLCMLPredictor()
corsi_predictor = CorsiMLPredictor()

