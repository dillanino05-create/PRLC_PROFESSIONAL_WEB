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
                print(f'✅ MLP cargado desde {mp}')
        except Exception as e:
            print(f'⚠️ Model error: {e}')
        try:
            if os.path.exists(sp):
                self.scaler = joblib.load(sp)
                print(f'✅ Scaler cargado')
        except Exception as e:
            print(f'⚠️ Scaler error: {e}')
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
            CON = TA - TOT
            CP  = (CON / TN * 100) if TN > 0 else 0
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
            return {
                'model_used': True,
                'predicted_code': pc,
                'predicted_profile': info['key'],
                'confidence': conf,
                'confidence_percent': f'{conf * 100:.1f}%',
                'profile_info': info,
                'all_probs': {self.PROFILES[i]['key']: float(p) for i, p in enumerate(probs)}
            }
        except Exception as e:
            return {'model_used': False, 'error': str(e)}


# Singleton
predictor = PLCMLPredictor()
