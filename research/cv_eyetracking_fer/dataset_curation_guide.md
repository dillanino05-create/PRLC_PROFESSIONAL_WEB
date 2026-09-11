# 📚 Guía de Adquisición y Curación de Datasets (FER & Eye Tracking)
## MecaPsi Cognitive Systems · PLC Professional (R&D)

Esta guía detalla la estrategia científica para descargar, filtrar, preprocesar y balancear datasets públicos para entrenar modelos de **Reconocimiento de Emociones Faciales (FER)** y **Estimación de Mirada (Gaze Tracking)** específicamente optimizados para webcams convencionales de portátiles.

---

## 1. Datasets de Reconocimiento de Emociones Faciales (FER)

### 1.1 AffectNet (El Estándar de Oro para Estados Afectivos Reales)
- **Repositorio Oficial / Solicitud Académica:** [AffectNet Database](http://mohammadmahoor.com/affectnet/) (Universidad de Denver).
- **Volumen:** ~450.000 imágenes etiquetadas manualmente por jueces humanos.
- **Etiquetado:** 8 expresiones discretas (Neutral, Feliz, Triste, Sorprendido, Temor, Disgusto, Ira, Desdén) + Valores continuos de **Valencia** ([-1.0, +1.0]) y **Arousal** ([0.0, 1.0]).
- **Por qué es crucial para MecaPsi:**
  - Los tests psicológicos computarizados como el PLC no generan expresiones teatrales de "ira furiosa" o "terror pánico". Lo que experimenta el paciente es **frustración sutil** (Valencia baja, Arousal medio), **ansiedad evaluativa** (Valencia ligeramente negativa, Arousal alto) o **neutralidad concentrada**.
  - AffectNet permite filtrar exactamente por ventanas continuas de $Valencia \in [-0.6, -0.2]$ y $Arousal \in [0.4, 0.8]$ para capturar la frustración y el estrés cognitivo sin depender de gestos exagerados.

### 1.2 EmotioNet & FACS Action Units (Marcadores Anatómicos Directos)
- **Repositorio:** [EmotioNet Challenge](http://cbcsl.ece.ohio-state.edu/EmotionNetChallenge/) (Ohio State University).
- **Volumen:** 1.000.000 imágenes anotadas con Action Units (FACS de Paul Ekman).
- **AUs Relevantes en el Test PLC:**
  - **AU4 (Brow Lowerer):** Contracción del músculo corrugador superciliar. Indica confusión, duda y frustración inmediata ante un distractor engañoso.
  - **AU1 + AU2 (Inner/Outer Brow Raiser):** Hipervigilancia y ansiedad anticipatoria ante el cronómetro.
  - **AU24 (Lip Pressor):** Tensión mandibular y oclusión labial por sobrecarga ejecutiva.

### 1.3 RAF-DB (Real-world Affective Faces Database)
- **Repositorio:** [RAF-DB](http://www.whdeng.cn/RAF/model1.html).
- **Volumen:** ~30.000 imágenes in-the-wild etiquetadas por 40 anotadores independientes.
- **Uso en MecaPsi:** Validación cruzada del modelo para evitar sesgos raciales, de edad o condiciones de iluminación.

---

## 2. Datasets de Estimación de Mirada (Gaze & Iris Tracking)

### 2.1 MPIIGaze (El Benchmark Indispensable para Laptops)
- **Repositorio:** [MPIIGaze Dataset](https://www.mpi-inf.mpg.de/departments/computer-vision-and-machine-learning/research/gaze-based-human-computer-interaction/appearance-based-gaze-estimation-in-the-wild-mpiigaze) (Max Planck Institute for Informatics).
- **Volumen:** 213.659 imágenes capturadas con las webcams integradas de computadores portátiles durante las jornadas de trabajo cotidianas de 15 participantes a lo largo de varios meses.
- **Por qué es el mejor para MecaPsi:**
  - Exactamente las mismas condiciones que enfrenta nuestro software: distancia de 50 a 65 cm respecto a la pantalla, resolución de webcam de 480p/720p, iluminación natural que cambia a lo largo del día, reflejos en gafas y sombras faciales.
  - Anotado con coordenadas ground-truth $(X, Y)_{mm}$ en pantalla y pose de cabeza $(yaw, pitch, roll)$.

### 2.2 GazeCapture (Diversidad Masiva)
- **Repositorio:** [GazeCapture (MIT)](https://gazecapture.csail.mit.edu/).
- **Volumen:** ~2.5 millones de frames de 1.450 personas en smartphones y tablets.
- **Uso en MecaPsi:** Transfer learning para la extracción de parches oculares y pupilares invariantes al tamaño y resolución del sensor.

---

## 3. Pipeline de Preprocesamiento para Webcams de Baja Calidad

Las webcams ordinarias introducen ruido de sensor (sensor grain), baja tasa de cuadros con desenfoque de movimiento (motion blur) y exposición automática inconsistente. Para garantizar que el modelo Edge-AI sea robusto, se debe aplicar el siguiente pipeline de aumentación de datos durante el entrenamiento:

```python
import torchvision.transforms as T

low_res_webcam_augmentations = T.Compose([
    T.Resize((112, 112)), # Tamaño estandarizado del parche facial/ocular
    T.RandomApply([T.GaussianBlur(kernel_size=(3, 5), sigma=(0.5, 1.8))], p=0.4), # Simular desenfoque de webcam barata
    T.RandomApply([T.ColorJitter(brightness=0.35, contrast=0.35, saturation=0.2)], p=0.5), # Variación lumínica de pantalla
    T.RandomAffine(degrees=15, translate=(0.08, 0.08), scale=(0.92, 1.08)), # Movimientos de cabeza naturales
    T.ToTensor(),
    T.RandomErasing(p=0.15, scale=(0.02, 0.15)), # Oclusión parcial (pelo, manos o marcos de gafas)
    T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])
```

---

## 4. Normalización Biométrica y Calibración Rápida (15 Segundos)

Para evitar requerir modelos gigantescos y lentos, el enfoque arquitectónico óptimo para MecaPsi consiste en:
1. **Detección Geométrica de Landmarks 3D (MediaPipe Face Mesh):** Obtiene los 478 puntos faciales y los centros de iris (puntos 468 y 473) normalizados por la distancia interpupilar del sujeto.
2. **Calibración Rápida de 5 Puntos en el Frontend:**
   - Al iniciar la prueba, se presentan 5 círculos concéntricos en la pantalla (4 esquinas + centro).
   - El paciente mira a cada punto durante 2.5 segundos.
   - Con esas muestras, un regresor Ridge Regression en JavaScript ($O(n)$ en memoria) calcula la matriz de transformación afín que traduce el vector pupilar $(\Delta X_{iris}, \Delta Y_{iris})$ a coordenadas reales de la pantalla $(X_{px}, Y_{px})$.
   - Esto reduce el error de estimación de mirada a menos de **$3.2\text{ cm}$** sin necesidad de calibradores profesionales de hardware (tipo Tobii de 5.000 USD).
