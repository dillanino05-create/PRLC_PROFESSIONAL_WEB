# 🔬 R&D: Computer Vision Module (Eye Tracking & Facial Emotion Recognition)
## PLC Professional · MecaPsi Cognitive Systems

> **STATUS:** Research & Prototyping (Isolated from production code).
> **GOAL:** Web-based, privacy-first Edge-AI telemetry for gaze scanpath and micro-affective tracking during the 14-line Crossed Lines Test (PLC).

---

## 1. Architectural Architecture: Edge-AI vs. Cloud Streaming

```
[Webcam Stream (Patient Laptop)]
            │ (Local in-memory, never uploaded)
            ▼
┌─────────────────────────────────────────────────────────────┐
│                   BROWSER EDGE-AI RUNTIME                   │
│                                                             │
│   ┌────────────────────────┐    ┌───────────────────────┐   │
│   │ MediaPipe Face Mesh    │    │ FER MobileNetV3       │   │
│   │ (WASM + WebGL)         │    │ (ONNX Web / INT8)     │   │
│   │ 478 3D Landmarks       │    │ Inferred at 3 Hz      │   │
│   │ Rate: 30 FPS           │    │ in Web Worker         │   │
│   └───────────┬────────────┘    └───────────┬───────────┘   │
│               │ (Iris points 468-477)       │               │
│               ▼                             │               │
│   ┌────────────────────────┐                │               │
│   │ Ridge Regression Model │                │               │
│   │ Gaze Screen (X, Y) px  │                │               │
│   └───────────┬────────────┘                │               │
│               │                             │               │
│               ▼                             ▼               │
│   ┌─────────────────────────────────────────────────────┐   │
│   │        Temporal Telemetry Sync Engine               │   │
│   │        Sync with window.performance.now()           │   │
│   │        Correlated with Line #, Clicks, Errors       │   │
│   └──────────────────────────┬──────────────────────────┘   │
└──────────────────────────────┼──────────────────────────────┘
                               │ Lightweight JSON Payload
                               │ (~150 KB per full test)
                               ▼
        ┌─────────────────────────────────────────────┐
        │       FastAPI Backend / Supabase RLS        │
        │ - Red Flags Detection Engine                │
        │ - 5-Sheet Excel Compilation (openpyxl)      │
        └─────────────────────────────────────────────┘
```

---

## 2. Dataset Benchmarking Matrix

| Task | Target Dataset | Resolution Profile | Noise & Lighting Tolerance | Metric Baseline |
| :--- | :--- | :--- | :--- | :--- |
| **Gaze Estimation** | **MPIIGaze** | Standard laptop webcams (480p/720p) | High (natural desk & window light) | Mean Angular Error: $4.1^\circ$ ($\approx 3.5\text{ cm}$ on 15" screen) |
| **Iris & Landmarks** | **MediaPipe Iris (Google)** | Multi-device in-the-wild | Extreme head-pose variation ($\pm 35^\circ$) | Landmark localization error $< 2.2\text{ mm}$ |
| **Emotion / Affect** | **AffectNet (8 classes + V/A)** | Unconstrained facial images | High (shadows, varied skin tones) | Balanced Accuracy: $62.8\%$ (discrete), RMSE: $0.34$ (Valence/Arousal) |
| **Micro-expressions**| **EmotioNet (FACS AU)** | Action Units 4 (Brow Lowerer), 24 (Lip Tightener) | Subtle muscular contractions | F1-Score: $0.71$ on AU4 / AU12 |

---

## 3. Data Schema: High-Frequency Synchronized Stream

```typescript
export interface GazeSample {
  timestamp_ms: number;          // Monotonic clock (since line start)
  line_index: number;            // Active PLC test line (0 to 13)
  gaze: {
    screen_x: number;            // Projected gaze X in viewport pixels
    screen_y: number;            // Projected gaze Y in viewport pixels
    estimated_line: number;      // Line currently being focused on
    confidence: number;          // Tracking confidence [0.0 - 1.0]
    fixation_ms: number;         // Continuous gaze dwell time
  };
  pupillometry: {
    ear_left: number;            // Eye Aspect Ratio (Left)
    ear_right: number;           // Eye Aspect Ratio (Right)
    blink_active: boolean;       // EAR < 0.20 threshold
  };
  affect: {
    dominant: 'neutral' | 'anxiety' | 'frustration' | 'surprise';
    valence: number;             // [-1.0 to +1.0] (Negative to Positive)
    arousal: number;             // [0.0 to 1.0] (Calm to High Alert)
    scores: {
      neutral: number;
      frustration: number;
      anxiety: number;
    };
  };
  head_pose: {
    yaw: number;                 // Horizontal head turn
    pitch: number;               // Vertical head tilt
    roll: number;                // Side inclination
  };
  concurrent_motor_event?: {
    action: 'CLICK_TARGET' | 'CLICK_DISTRACTOR' | 'HOVER';
    stim_id: string;
    is_correct: boolean;
  };
}
```

---

## 4. Red Flag Heuristics for the Clinical Psychologist

```
               [Telemetry Stream]
                        │
       ┌────────────────┼────────────────┐
       ▼                ▼                ▼
[Scanpath Drift]   [Anxious Freeze]  [Frustrated Impulsivity]
Line mismatch > 600ms  Gaze std < 15px   Click on Distractor (COM)
or ΔX/Δt < -180px/s    & Anxiety > 0.65  + AU4 Brow Lowerer < 300ms
       │                │                │
       ▼                ▼                ▼
🚩 Red Flag:       🚩 Red Flag:      🚩 Red Flag:
Disorganized       Cognitive         Inhibitory Failure
Visual Sweeping    Freezing          with Immediate Error
                                     Awareness
```
