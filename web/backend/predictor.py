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
        0: {'key': 'Rendimiento_Tipico',    'nombre': 'Rendimiento Típico',
            'desc': 'Patrón de respuesta dentro del rango normativo esperado. Velocidad y precisión equilibradas.',
            'rasgos': ['CP% dentro del rango normativo', 'Proporción omisiones/comisiones equilibrada',
                       'Estabilidad temporal aceptable entre líneas']},
        1: {'key': 'Velocidad_Reducida',    'nombre': 'Velocidad Reducida con Omisiones',
            'desc': 'Patrón de procesamiento lento con umbral de respuesta elevado. Predominan omisiones sobre comisiones.',
            'rasgos': ['Alta tasa de omisiones', 'Velocidad por debajo de la media', 'Baja tasa de comisiones']},
        2: {'key': 'Alta_Velocidad',        'nombre': 'Alta Velocidad con Comisiones',
            'desc': 'Priorización de la velocidad sobre la exactitud. Umbral de respuesta bajo; tendencia a responder sin verificar.',
            'rasgos': ['Alta tasa de comisiones (falsos positivos)', 'Velocidad superior a la media',
                       'Trade-off velocidad-exactitud desfavorable']},
        3: {'key': 'Patron_Mixto',          'nombre': 'Patrón Mixto',
            'desc': 'Combinación de errores por omisión y comisión con alta variabilidad temporal. Inestabilidad en el control atencional.',
            'rasgos': ['Omisiones y comisiones elevadas simultáneamente', 'Alta variabilidad entre líneas',
                       'Posible decaimiento en el segundo bloque']},
        4: {'key': 'Decaimiento_Progresivo','nombre': 'Decaimiento Progresivo',
            'desc': 'Rendimiento inicial aceptable con deterioro progresivo. Baja resistencia a la monotonía.',
            'rasgos': ['Rendimiento menor en bloque 2 vs bloque 1', 'Aumento de errores hacia el final',
                       'Tiempo por línea creciente en últimas filas']},
        5: {'key': 'Fatiga_Alta',           'nombre': 'Activación Sostenida Baja',
            'desc': 'Rendimiento reducido y constante en todas las líneas. Posible estado de baja activación.',
            'rasgos': ['Velocidad global reducida', 'Pocas oscilaciones entre bloques',
                       'CP% por debajo del percentil esperado']},
        6: {'key': 'Alto_Rendimiento',      'nombre': 'Alto Rendimiento',
            'desc': 'Patrón superior al normativo. Alta velocidad sostenida con precisión elevada.',
            'rasgos': ['CP% superior al percentil 85', 'Baja variabilidad temporal', 'Escasa fatiga entre bloques']},
        7: {'key': 'Inhibicion_Elevada',    'nombre': 'Estrategia Inhibitoria Elevada',
            'desc': 'Velocidad muy reducida con casi cero comisiones. Estrategia ultra-cautelosa.',
            'rasgos': ['Muy baja tasa de comisiones', 'Velocidad por debajo del percentil 25',
                       'Alto tiempo por línea sin mejora entre bloques']},
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
