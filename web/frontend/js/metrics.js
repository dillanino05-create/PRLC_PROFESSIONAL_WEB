// metrics.js — Cálculo de métricas (portado exacto de _calc_metrics en el desktop)

function calcMetrics(linesData, clickLog, age) {
  // Encontrar la última página con actividad real
  let lastAttemptedIndex = -1;
  for (let i = 0; i < linesData.length; i++) {
    if ((linesData[i].evaluados || 0) > 0) {
      lastAttemptedIndex = i;
    }
  }
  const activeLines = lastAttemptedIndex >= 0 ? linesData.slice(0, lastAttemptedIndex + 1) : linesData.slice(0, 1);
  const isIncomplete = (lastAttemptedIndex + 1) < linesData.length;

  const TA  = activeLines.reduce((s, l) => s + l.aciertos,   0);
  const O   = activeLines.reduce((s, l) => s + l.omisiones,  0);
  const COM = activeLines.reduce((s, l) => s + l.comisiones, 0);
  const TN  = TA + O;
  const TOT = O + COM;
  const CON = TA - TOT;
  const CP  = TN > 0 ? (CON / TN) * 100 : 0;

  const times = activeLines.map(l => l.tiempo_s);
  const totalTime = times.reduce((a, b) => a + b, 0);
  const meanTpl   = totalTime / times.length;
  const variance  = times.reduce((s, t) => s + (t - meanTpl) ** 2, 0) / Math.max(times.length - 1, 1);
  const stdTpl    = Math.sqrt(variance);
  const cvTime    = meanTpl > 0 ? (stdTpl / meanTpl) * 100 : 0;

  const totalEvaluados = activeLines.reduce((s, l) => s + (l.evaluados !== undefined ? l.evaluados : 47), 0);
  const procSpeed = totalTime > 0 ? (totalEvaluados / totalTime) * 60 : 0;
  const efficiency= totalTime > 0 ? (TA / totalTime) * 60 : 0;
  const FA        = totalTime > 0 ? TA / totalTime : 0;
  const GQ        = (TN > 0 && totalTime > 0) ? (TA * TA) / (TN * totalTime) : 0;

  const hits = activeLines.map(l => l.aciertos);
  const hm   = hits.reduce((a, b) => a + b, 0) / hits.length;
  const hs   = Math.sqrt(hits.reduce((s, h) => s + (h - hm) ** 2, 0) / Math.max(hits.length - 1, 1));
  const VAR       = hm > 0 ? (hs / hm) * 100 : 0;
  const estabilidad = Math.max(0, 100 - VAR);
  const consistency = Math.max(...hits) - Math.min(...hits);

  // TRM se calcula comparando los dos bloques de líneas activas
  const mid = Math.floor(activeLines.length / 2);
  const h1  = activeLines.slice(0, mid).reduce((s, l) => s + l.aciertos, 0);
  const h2  = activeLines.slice(mid).reduce((s, l) => s + l.aciertos, 0);
  const TRM = h1 > 0 ? ((h2 - h1) / h1) * 100 : 0;

  const IVR = procSpeed > 0 ? COM / (procSpeed / 100) : 0;

  // Block hits (5 blocks for MLP) - se calculan sobre las 14 líneas para la IA
  const bs = Math.floor(linesData.length / 5);
  const blockHits = [];
  for (let i = 0; i < 5; i++) {
    const s = i * bs;
    const e = i < 4 ? s + bs : linesData.length;
    blockHits.push(linesData.slice(s, e).reduce((sum, l) => sum + l.aciertos, 0));
  }

  const errorPat = O > COM * 2.5 ? 1 : COM > O * 2.5 ? 2 : O > COM ? 3 : COM > O ? 4 : 5;
  const af       = age < 18 ? 0.90 : age > 60 ? 0.85 : age > 40 ? 0.95 : 1.0;
  const adjScore = CP * af;

  // Tiempos de reacción desde el log de clics
  const firstClicks = {};
  (clickLog || []).forEach(cl => {
    if (cl.action === 'sel') {
      const key = `${cl.line}_${cl.stim_idx}`;
      if (!(key in firstClicks)) firstClicks[key] = cl.elapsed_ms;
    }
  });
  const rts    = Object.values(firstClicks);
  const meanRt = rts.length > 0 ? rts.reduce((a, b) => a + b, 0) / rts.length : 0;
  const sortedRts = [...rts].sort((a, b) => a - b);
  const medRt  = sortedRts.length > 0
    ? (sortedRts.length % 2 === 0
        ? (sortedRts[sortedRts.length/2-1] + sortedRts[sortedRts.length/2]) / 2
        : sortedRts[Math.floor(sortedRts.length/2)])
    : 0;

  // Patrón de atención
  let attnStyle, attnDesc;
  if (TOT <= 3 || (CP >= 95 && TOT <= 5)) {
    attnStyle = 'Alta Precisión Operativa';
    attnDesc  = 'Volumen de fallas estadísticamente marginal. El sujeto evidenció una ejecución óptima sin sesgos hacia la omisión o la comisión.';
  } else if (O > COM * 2) {
    attnStyle = 'Omisión predominante';
    attnDesc  = 'Mayor proporción de omisiones frente a comisiones. El evaluado registró latencia en el reconocimiento, no seleccionando estímulos objetivo.';
  } else if (COM > O * 2) {
    attnStyle = 'Comisión predominante';
    attnDesc  = 'Mayor proporción de comisiones frente a omisiones. El evaluado registró un alto volumen de marcado sobre estímulos distractores.';
  } else if (CP >= 75) {
    attnStyle = 'Balance simétrico';
    attnDesc  = 'Equilibrio probabilístico entre la tasa de respuesta y la precisión transversal de la prueba.';
  } else {
    attnStyle = 'Tasa de variabilidad alta';
    attnDesc  = 'Ausencia de tendencia unilateral de respuesta cruzada. Alta variabilidad de acierto-error métrico.';
  }

  const totalSaltos = activeLines.reduce((s, l) => s + (l.saltos_erraticos || 0), 0);
  if (totalSaltos > 3) {
    attnStyle = 'Comportamiento Errático de Barrido Visual';
    attnDesc  = `Se registraron ${totalSaltos} saltos/retrocesos. El paciente incumplió la regla de barrido visual de izquierda a derecha de forma repetida, evidenciando un rastreo desorganizado.`;
  }

  // Redes de atención clínicas
  let sysFocus = [];
  if (CP >= 80) {
    sysFocus.push('Selectiva preservada');
  } else if (COM > O) {
    sysFocus.push('Selectiva con falla inhibitoria');
  } else {
    sysFocus.push('Selectiva en déficit de rastreo');
  }

  if (TRM >= -10 && estabilidad >= 80) {
    sysFocus.push('Sostenida óptima');
  } else if (TRM < -25) {
    sysFocus.push('Sostenida en declive cronológico');
  } else {
    sysFocus.push('Sostenida fluctuante');
  }
  const focusType = sysFocus.join('  •  ');

  const lastLine = lastAttemptedIndex >= 0 ? linesData[lastAttemptedIndex].linea : 0;
  const lastChar = lastAttemptedIndex >= 0 ? linesData[lastAttemptedIndex].evaluados : 0;

  return {
    TA, O, COM, TN, TOT, CON, CP,
    totalTime, meanTpl, stdTpl, cvTime,
    procSpeed, efficiency, FA, GQ,
    VAR, estabilidad, consistency,
    TRM, IVR, blockHits, errorPat, adjScore,
    meanRt, medRt, attnStyle, attnDesc, focusType,
    isIncomplete, lastLine, lastChar
  };
}

function generateNarrative(m) {
  const speedLvl = m.procSpeed > 120 ? 'superior a la media poblacional' : m.procSpeed > 80 ? 'homogéneo a la media general' : 'por debajo de la franja normativa inferior';
  const cpLvl    = m.CP >= 80 ? 'alto' : m.CP >= 60 ? 'medio' : 'inferior';
  const trmTxt   = m.TRM > 5         ? 'incremento lineal'
                 : m.TRM > -15       ? 'fluctuación base estable'
                 : m.TRM > -30       ? 'descenso métrico de desempeño cronológico'
                 : 'decrecimiento agudo progresivo';
  const trmSign  = m.TRM >= 0 ? '+' : '';
  
  let base = [
    `Velocidad de procesamiento observada: ${Math.round(m.procSpeed)} estímulos/min (${speedLvl}).`,
    `Capacidad de concentración cruda calculada (CP) = ${m.CP.toFixed(1)} % (${cpLvl}).`,
    `Tasa estadística de consistencia visual (Estabilidad) = ${Math.round(m.estabilidad)} % (Varianza intra-bloque = ${m.VAR.toFixed(1)} %).`,
    `Curva de resistencia rítmica cronológica: ${trmTxt} (Medición TRM = ${trmSign}${m.TRM.toFixed(1)} %).`,
    `Tiempo de reacción iterativo (Media base): ${Math.round(m.meanRt)} ms.`,
    `Estado de las redes neuronales implicadas: ${m.focusType}.`,
    `Patrón predominante de respuesta algorítmica: ${m.attnStyle}.`
  ].join('  ');

  if (m.isIncomplete) {
    base = `⚠️ EVALUACIÓN INCOMPLETA (Detención anticipada en Página ${m.lastLine}, estímulo ${m.lastChar}). Las métricas se calcularon de forma proporcional sobre las páginas intentadas. ` + base;
  }
  return base;
}

/* ═══════════════════════════════════════════════════════════════════════════════
   BIOMARCADORES DIGITALES — Cinemática del Cursor (Jitter / Tremor Motor)
   ────────────────────────────────────────────────────────────────────────────
   Calcula el Tremor Score por línea a partir de las posiciones del mouse
   muestreadas a ~60fps durante la ejecución del test.

   Fórmula:
     velocidades    v[i] = √((Δx)²+(Δy)²) / Δt
     aceleraciones  a[i] = |v[i] - v[i-1]| / Δt
     jitter_raw     = σ(aceleraciones)          ← desviación estándar
     cambios_dir    θ > 45° entre muestras consecutivas
     tremor_score   = jitter_raw × (1 + 0.3 × dirChanges/s)
     tremor_flag    = tremor_score > TREMOR_THRESHOLD

   Umbral clínico inicial: 85.0 (px/s² relativo). Calibrar con datos reales.
═══════════════════════════════════════════════════════════════════════════════ */
const TREMOR_THRESHOLD = 85.0;

function computeTremorScore(samples) {
  // samples: [{x, y, t}, …] donde t es performance.now() en ms
  if (!samples || samples.length < 5) return { score: 0, flag: false };

  const accels     = [];
  const dirChanges = [];

  for (let i = 2; i < samples.length; i++) {
    const dt1 = samples[i-1].t - samples[i-2].t;
    const dt2 = samples[i].t   - samples[i-1].t;
    if (dt1 <= 0 || dt2 <= 0) continue;

    const dx1 = samples[i-1].x - samples[i-2].x;
    const dy1 = samples[i-1].y - samples[i-2].y;
    const dx2 = samples[i].x   - samples[i-1].x;
    const dy2 = samples[i].y   - samples[i-1].y;

    const v1 = Math.sqrt(dx1*dx1 + dy1*dy1) / dt1;
    const v2 = Math.sqrt(dx2*dx2 + dy2*dy2) / dt2;
    accels.push(Math.abs(v2 - v1) / dt2);

    // Cambio de dirección > 45° = posible temblor o corrección brusca
    const theta1 = Math.atan2(dy1, dx1);
    const theta2 = Math.atan2(dy2, dx2);
    let dTheta = Math.abs(theta2 - theta1);
    if (dTheta > Math.PI) dTheta = 2 * Math.PI - dTheta;
    if (dTheta > Math.PI / 4) dirChanges.push(1);
  }

  if (accels.length === 0) return { score: 0, flag: false };

  // Jitter = σ de las aceleraciones instantáneas
  const mean     = accels.reduce((a, b) => a + b, 0) / accels.length;
  const variance = accels.reduce((s, a) => s + (a - mean) ** 2, 0) / accels.length;
  const jitter   = Math.sqrt(variance);

  // Ponderación por densidad de cambios de dirección
  const totalDurationSec = Math.max((samples[samples.length - 1].t - samples[0].t) / 1000, 0.001);
  const dirChangesPerSec = dirChanges.length / totalDurationSec;
  const score = jitter * (1 + 0.3 * dirChangesPerSec);

  return { 
    score: parseFloat(score.toFixed(2)), 
    flag: score > TREMOR_THRESHOLD,
    microtremor: parseFloat(jitter.toFixed(2))
  };
}

/* ═══════════════════════════════════════════════════════════════════════════════
   BIOMARCADORES CONDUCTUALES — Validación de Barrido Izquierda a Derecha
   ────────────────────────────────────────────────────────────────────────────
   Evalúa la progresión espacial del cursor para detectar retrocesos erráticos
   y calcula la regularidad direccional del barrido visual/motor.
═══════════════════════════════════════════════════════════════════════════════ */
function computeSweepMetrics(samples) {
  if (!samples || samples.length < 5) {
    return { sweep_regularity: 100.0, retrocesos: 0, microtremors_count: 0 };
  }

  let forwardPx = 0;
  let backwardPx = 0;
  let retrocesos = 0;
  let microtremorsCount = 0;

  for (let i = 1; i < samples.length; i++) {
    const dx = samples[i].x - samples[i-1].x;
    const dy = samples[i].y - samples[i-1].y;
    const dt = Math.max(samples[i].t - samples[i-1].t, 1);

    if (dx > 0) {
      forwardPx += dx;
    } else if (dx < 0) {
      backwardPx += Math.abs(dx);
      if (Math.abs(dx) > 25) {
        retrocesos++; // Movimiento brusco hacia atrás
      }
    }

    // Microtemblor instantáneo (fluctuación de alta aceleración)
    const vel = Math.sqrt(dx*dx + dy*dy) / (dt / 1000);
    if (vel > 350 && Math.abs(dx) < 15 && Math.abs(dy) < 15) {
      microtremorsCount++;
    }
  }

  const totalHorizontal = forwardPx + backwardPx;
  const sweep_regularity = totalHorizontal > 0 
    ? parseFloat(Math.min(100, Math.max(0, (forwardPx / totalHorizontal) * 100)).toFixed(1))
    : 100.0;

  return {
    sweep_regularity,
    retrocesos,
    microtremors_count: microtremorsCount
  };
}

/* ═══════════════════════════════════════════════════════════════════════════════
   BIOMARCADORES OCULOMOTORES (MediaPipe Face Mesh)
   ────────────────────────────────────────────────────────────────────────────
   Calcula parpadeos (EAR), tasa de parpadeo por minuto y eventos de desvío
   de la mirada respecto al área del Canvas.
═══════════════════════════════════════════════════════════════════════════════ */
function computeOculomotorMetrics(earSamples, gazeEvents, durationSec) {
  if (!earSamples || earSamples.length === 0) {
    return {
      camera_active: false,
      ear_mean: 0.0,
      blink_count: 0,
      blink_rate_min: 0.0,
      gaze_diverted_count: 0,
      gaze_diverted_ms: 0.0
    };
  }

  // Media de EAR
  const sumEar = earSamples.reduce((acc, s) => acc + (s.ear || 0), 0);
  const ear_mean = parseFloat((sumEar / earSamples.length).toFixed(3));

  // Conteo de parpadeos (transiciones de EAR > 0.20 a EAR < 0.20)
  let blinkCount = 0;
  let inBlink = false;
  for (let i = 0; i < earSamples.length; i++) {
    const ear = earSamples[i].ear || 0;
    if (ear < 0.20 && !inBlink) {
      blinkCount++;
      inBlink = true;
    } else if (ear >= 0.20) {
      inBlink = false;
    }
  }

  const validDurationSec = Math.max(durationSec || 1, 1);
  const blink_rate_min = parseFloat(((blinkCount / validDurationSec) * 60).toFixed(1));

  // Conteo y tiempo total de desvíos de mirada
  let gazeDivertedCount = 0;
  let gazeDivertedMs = 0;
  if (gazeEvents && gazeEvents.length > 0) {
    gazeDivertedCount = gazeEvents.length;
    gazeDivertedMs = gazeEvents.reduce((acc, ev) => acc + (ev.duration_ms || 0), 0);
  }

  return {
    camera_active: true,
    ear_mean,
    blink_count: blinkCount,
    blink_rate_min,
    gaze_diverted_count: gazeDivertedCount,
    gaze_diverted_ms: parseFloat(gazeDivertedMs.toFixed(1))
  };
}

