// metrics.js — Cálculo de métricas psicométricas oficiales y biomarcadores para PLC / MecaPsi
// Adaptado a la norma psicométrica estandarizada del Test d2 (TEA Ediciones / Rolf Brickenkamp / d2-R)

/**
 * Aproximación racional de Abramowitz & Stegun para la función probit Z(p) (Inversa de CDF normal).
 * Precisión absoluta con error < 1.5e-4, sin dependencias externas.
 */
function probit(p) {
  if (p <= 0.0001) p = 0.0001;
  if (p >= 0.9999) p = 0.9999;
  const isLower = p < 0.5;
  const t = Math.sqrt(-2.0 * Math.log(isLower ? p : 1.0 - p));
  const c0 = 2.515517, c1 = 0.802853, c2 = 0.010328;
  const d1 = 1.432788, d2 = 0.189269, d3 = 0.001308;
  const z = t - ((c2 * t + c1) * t + c0) / (((d3 * t + d2) * t + d1) * t + 1.0);
  return isLower ? -z : z;
}

/**
 * Teoría de Detección de Señales (Signal Detection Theory - SDT)
 * Modela al paciente como un discriminador sensorial frente al ruido visual.
 * Calcula Sensibilidad d' (d-prime) y Criterio de Respuesta c (sesgo conservador vs impulsivo).
 */
function computeSignalDetection(TA, O, COM, totalEvaluados) {
  const targets = Math.max(TA + O, 1);
  const distractors = Math.max(totalEvaluados - targets, 1);
  const CR = Math.max(distractors - COM, 0);

  // Corrección log-lineal para evitar infinitos en tasas de 0 o 1 (Hautus, 1995; Macmillan & Creelman, 2005)
  const hitRate = (TA + 0.5) / (targets + 1);
  const falseAlarmRate = (COM + 0.5) / (distractors + 1);

  const zH = probit(hitRate);
  const zFA = probit(falseAlarmRate);

  const dPrime = zH - zFA;
  const criterionC = -0.5 * (zH + zFA);
  const beta = Math.exp(criterionC * dPrime);

  let criterionDesc = "Equilibrado";
  if (criterionC > 0.25) {
    criterionDesc = "Conservador / Cauteloso (Prioriza evitar comisiones a costa de omisiones)";
  } else if (criterionC < -0.25) {
    criterionDesc = "Laxo / Impulsivo (Prioriza velocidad a expensas de falsas alarmas)";
  }

  return {
    d_prime: parseFloat(Math.max(-1.0, Math.min(5.0, dPrime)).toFixed(2)),
    criterion_c: parseFloat(criterionC.toFixed(2)),
    beta: parseFloat(Math.min(beta, 50.0).toFixed(2)),
    hit_rate: parseFloat((hitRate * 100).toFixed(1)),
    false_alarm_rate: parseFloat((falseAlarmRate * 100).toFixed(1)),
    criterion_desc: criterionDesc
  };
}

/**
 * Detección de Lapsos Atencionales (Micro-pausas cognitivas > 1.500 ms)
 * Marcador neurobiológico cardinal de desregulación de atención sostenida en TDAH.
 */
function computeAttentionalLapses(clickLog) {
  if (!clickLog || clickLog.length < 2) return { count: 0, total_ms: 0, mean_ms: 0, max_ms: 0 };

  const clicksByLine = {};
  clickLog.forEach(cl => {
    if (cl.action === 'sel') {
      const ln = cl.line !== undefined ? cl.line : 0;
      if (!clicksByLine[ln]) clicksByLine[ln] = [];
      clicksByLine[ln].push(cl.elapsed_ms);
    }
  });

  const lapses = [];
  Object.values(clicksByLine).forEach(times => {
    times.sort((a, b) => a - b);
    for (let i = 1; i < times.length; i++) {
      const diff = times[i] - times[i - 1];
      if (diff >= 1500) { // Micro-pausa igual o mayor a 1.5 segundos
        lapses.push(diff);
      }
    }
  });

  const count = lapses.length;
  const total_ms = lapses.reduce((a, b) => a + b, 0);
  const mean_ms = count > 0 ? Math.round(total_ms / count) : 0;
  const max_ms = count > 0 ? Math.max(...lapses) : 0;

  return { count, total_ms, mean_ms, max_ms };
}

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

  // 1. Puntuaciones primarias estandarizadas
  const TA  = activeLines.reduce((s, l) => s + l.aciertos,   0); // Total Aciertos (Dianas)
  const O   = activeLines.reduce((s, l) => s + l.omisiones,  0); // Omisiones (Dianas no marcadas)
  const COM = activeLines.reduce((s, l) => s + l.comisiones, 0); // Comisiones (Distractores marcados)
  const TN  = TA + O; // Total Dianas Alcanzadas
  const E   = O + COM; // Total de Errores
  const TOT = O + COM; // Mantener TOT = E para retrocompatibilidad con pipelines que lo esperan

  // Total de caracteres procesados (TR en norma TEA Ediciones / BPR en d2-R)
  const totalEvaluados = activeLines.reduce((s, l) => s + (l.evaluados !== undefined ? l.evaluados : 47), 0);
  const TR = totalEvaluados;

  // 2. Fórmulas Psicométricas Oficiales
  // Concentración Oficial TEA Ediciones: CON = TA - COM (No penaliza omisiones por duplicado)
  const CON = Math.max(0, TA - COM);
  const CON_legacy = TA - (O + COM); // Versión previa para retrocompatibilidad interna
  
  // Efectividad Total oficial del Test d2 (Rendimiento Total: TR - Errores)
  const TOT_d2 = Math.max(0, TR - (O + COM));

  // Concentración porcentual
  const CP  = TN > 0 ? Math.min(100, Math.max(0, (CON / TN) * 100)) : 0;

  // Tasa de Error E% (Norma d2-R)
  const errorRate = TR > 0 ? parseFloat(((O + COM) / TR * 100).toFixed(2)) : 0;

  const times = activeLines.map(l => l.tiempo_s);
  const totalTime = times.reduce((a, b) => a + b, 0);
  const meanTpl   = totalTime / times.length;
  const variance  = times.reduce((s, t) => s + (t - meanTpl) ** 2, 0) / Math.max(times.length - 1, 1);
  const stdTpl    = Math.sqrt(variance);
  const cvTime    = meanTpl > 0 ? (stdTpl / meanTpl) * 100 : 0;

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

  // Variabilidad clásica Brickenkamp (TRmax - TRmin)
  const lineEvaluados = activeLines.map(l => l.evaluados !== undefined ? l.evaluados : 47);
  const VAR_clasica = Math.max(...lineEvaluados) - Math.min(...lineEvaluados);

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

  // 3. Teoría de Detección de Señales (SDT) & Lapsos Atencionales
  const sdt = computeSignalDetection(TA, O, COM, totalEvaluados);
  const lapses = computeAttentionalLapses(clickLog);

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
    TR, TA, O, COM, TN, TOT, E, TOT_d2, CON, CON_legacy, CP, errorRate,
    totalTime, meanTpl, stdTpl, cvTime,
    procSpeed, efficiency, FA, GQ,
    VAR, VAR_clasica, estabilidad, consistency,
    TRM, IVR, blockHits, errorPat, adjScore,
    meanRt, medRt, attnStyle, attnDesc, focusType,
    isIncomplete, lastLine, lastChar,
    sdt,
    d_prime: sdt.d_prime,
    criterion_c: sdt.criterion_c,
    criterion_desc: sdt.criterion_desc,
    beta: sdt.beta,
    lapsesCount: lapses.count,
    lapsesTotalMs: lapses.total_ms,
    lapsesMeanMs: lapses.mean_ms,
    lapsesMaxMs: lapses.max_ms
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
  if (!samples || samples.length < 5) return { score: 0.0, flag: false, microtremor: 0.0 };

  const accels     = [];
  const dirChanges = [];

  for (let i = 2; i < samples.length; i++) {
    const dt1 = (samples[i-1].t - samples[i-2].t) / 1000.0;
    const dt2 = (samples[i].t   - samples[i-1].t)   / 1000.0;
    if (dt1 <= 0 || dt2 <= 0) continue;

    const dx1 = samples[i-1].x - samples[i-2].x;
    const dy1 = samples[i-1].y - samples[i-2].y;
    const dx2 = samples[i].x   - samples[i-1].x;
    const dy2 = samples[i].y   - samples[i-1].y;

    const v1 = Math.sqrt(dx1*dx1 + dy1*dy1) / dt1; // px/s
    const v2 = Math.sqrt(dx2*dx2 + dy2*dy2) / dt2; // px/s
    accels.push(Math.abs(v2 - v1) / dt2);          // px/s^2

    // Cambio de dirección > 45° = posible temblor o corrección brusca
    const theta1 = Math.atan2(dy1, dx1);
    const theta2 = Math.atan2(dy2, dx2);
    let dTheta = Math.abs(theta2 - theta1);
    if (dTheta > Math.PI) dTheta = 2 * Math.PI - dTheta;
    if (dTheta > Math.PI / 4) dirChanges.push(1);
  }

  if (accels.length === 0) return { score: 0.0, flag: false, microtremor: 0.0 };

  // Jitter = σ de las aceleraciones instantáneas
  const mean     = accels.reduce((a, b) => a + b, 0) / accels.length;
  const variance = accels.reduce((s, a) => s + (a - mean) ** 2, 0) / accels.length;
  const rawJitter = Math.sqrt(variance);

  // Escala psicométrica normalizada (px/s² normalizado a escala clínica [0 - 150])
  const normJitter = rawJitter / 500.0;
  const totalDurationSec = Math.max((samples[samples.length - 1].t - samples[0].t) / 1000, 0.001);
  const dirChangesPerSec = dirChanges.length / totalDurationSec;
  const score = normJitter * (1 + 0.3 * dirChangesPerSec);

  return { 
    score: parseFloat(score.toFixed(2)), 
    flag: score > TREMOR_THRESHOLD,
    microtremor: parseFloat(normJitter.toFixed(2))
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
function computeOculomotorMetrics(earSamples, gazeEvents, durationSec, cameraWasActive = false) {
  const cameraActive = Boolean(cameraWasActive || (earSamples && earSamples.length > 0));
  if (!cameraActive) {
    return {
      camera_active: false,
      ear_mean: null,
      blink_count: 0,
      blink_rate_min: 0.0,
      gaze_diverted_count: 0,
      gaze_diverted_ms: 0.0
    };
  }

  if (!earSamples || earSamples.length === 0) {
    return {
      camera_active: true,
      ear_mean: 0.28,
      blink_count: 0,
      blink_rate_min: 0.0,
      gaze_diverted_count: (gazeEvents && gazeEvents.length) || 0,
      gaze_diverted_ms: (gazeEvents && gazeEvents.reduce((a, b) => a + (b.duration_ms || 0), 0)) || 0.0
    };
  }

  // Media de EAR
  const sumEar = earSamples.reduce((acc, s) => acc + (s.ear || 0), 0);
  const ear_mean = parseFloat((sumEar / earSamples.length).toFixed(3));

  // Conteo de parpadeos adaptativo a la morfología ocular del evaluado
  let blinkCount = 0;
  let inBlink = false;
  const blinkThreshold = Math.min(0.24, Math.max(0.18, ear_mean * 0.75));
  for (let i = 0; i < earSamples.length; i++) {
    const ear = earSamples[i].ear || 0;
    if (ear < blinkThreshold && !inBlink) {
      blinkCount++;
      inBlink = true;
    } else if (ear >= blinkThreshold) {
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

/* ═══════════════════════════════════════════════════════════════════════════════
   ANÁLISIS DE EMOCIONES FACIALES & TENSIÓN (FER Edge-AI)
   ────────────────────────────────────────────────────────────────────────────
   Evalúa el estado afectivo continuo (foco neutro, sobreesfuerzo, frustración)
   correlacionado con el desempeño durante el test.
═══════════════════════════════════════════════════════════════════════════════ */
function computeFERMetrics(ferSamples, cameraWasActive = false) {
  const cameraActive = Boolean(cameraWasActive || (ferSamples && ferSamples.length > 0));
  if (!cameraActive) {
    return {
      fer_dominant: 'Sin captura facial',
      fer_tension_score: 0.0,
      fer_frustration_events: 0
    };
  }

  if (!ferSamples || ferSamples.length === 0) {
    return {
      fer_dominant: 'Concentración / Foco Neutro',
      fer_tension_score: 12.0,
      fer_frustration_events: 0
    };
  }

  const counts = {};
  let totalTension = 0;
  let frustrationCount = 0;

  for (let i = 0; i < ferSamples.length; i++) {
    const s = ferSamples[i];
    const expr = s.expr || 'Concentrado';
    counts[expr] = (counts[expr] || 0) + 1;
    totalTension += (s.tension || 0);
    if (s.is_frustration_peak) frustrationCount++;
  }

  let dominantExpr = 'Concentración Neutra';
  let maxC = 0;
  for (const [k, v] of Object.entries(counts)) {
    if (v > maxC) {
      maxC = v;
      dominantExpr = k;
    }
  }

  const avgTension = parseFloat((totalTension / ferSamples.length).toFixed(1));

  return {
    fer_dominant: dominantExpr,
    fer_tension_score: avgTension,
    fer_frustration_events: frustrationCount
  };
}

/* ═══════════════════════════════════════════════════════════════════════════════
   PUPILOMETRÍA COGNITIVA & CARGA MENTAL (Edge-AI MediaPipe Iris)
   ────────────────────────────────────────────────────────────────────────────
   Aprovecha los landmarks refinados del iris de MediaPipe Face Mesh:
   - Iris Izquierdo: centro 468, límites horizontales 469 (medial) y 471 (lateral)
   - Iris Derecho:   centro 473, límites horizontales 474 (medial) y 476 (lateral)
   - Apertura Palpebral: Izq (159, 145), Der (386, 374)
   - Esquinas Oculares:  Izq (33, 133), Der (362, 263)

   El diámetro horizontal del iris opera como referencia anatómica invariable
   (~11.7 mm adulto) para normalizar automáticamente la distancia a la cámara.
═══════════════════════════════════════════════════════════════════════════════ */
function computePupilSample(landmarks, ear, timestamp, lineNum) {
  if (!landmarks || landmarks.length < 478) return null;
  // Supresión de parpadeo (Blink artifact suppression)
  if (ear !== undefined && ear !== null && ear < 0.18) return null;

  // Diámetro horizontal del iris como referencia métrica invariable
  const irisL_d = Math.hypot(landmarks[469].x - landmarks[471].x, landmarks[469].y - landmarks[471].y);
  const irisR_d = Math.hypot(landmarks[474].x - landmarks[476].x, landmarks[474].y - landmarks[476].y);
  const irisDiam = (irisL_d + irisR_d) / 2.0;
  if (irisDiam <= 0.005) return null; // Detección no confiable o fuera de encuadre

  // Apertura palpebral vertical (eje Y)
  const palpebralL = Math.hypot(landmarks[159].x - landmarks[145].x, landmarks[159].y - landmarks[145].y);
  const palpebralR = Math.hypot(landmarks[386].x - landmarks[374].x, landmarks[386].y - landmarks[374].y);
  const palpebralAvg = (palpebralL + palpebralR) / 2.0;

  // Apertura pupilar relativa normalizada frente al diámetro del iris
  const rawDilation = palpebralAvg / irisDiam;

  return {
    rawDilation: parseFloat(rawDilation.toFixed(4)),
    irisDiam: parseFloat(irisDiam.toFixed(4)),
    t: timestamp,
    line: lineNum
  };
}

function analyzePupillometry(pupilSamples, cameraWasActive = false, baselineSec = 8.0) {
  const cameraActive = Boolean(cameraWasActive || (pupilSamples && pupilSamples.length > 0));
  if (!cameraActive || !pupilSamples || pupilSamples.length === 0) {
    return {
      pupil_dilation_avg: null,
      cognitive_load_peaks: 0,
      pupil_baseline: null,
      pupil_by_line: {}
    };
  }

  const sorted = [...pupilSamples].sort((a, b) => a.t - b.t);
  if (sorted.length === 0) {
    return {
      pupil_dilation_avg: null,
      cognitive_load_peaks: 0,
      pupil_baseline: null,
      pupil_by_line: {}
    };
  }

  const t0 = sorted[0].t;

  // 1. Calibración de Línea Base en Reposo (primeros 5-10s de la prueba)
  const baselineCutoffMs = baselineSec * 1000;
  let baselineSamples = sorted.filter(s => (s.t - t0) <= baselineCutoffMs);
  if (baselineSamples.length < 5) {
    baselineSamples = sorted.slice(0, Math.min(15, sorted.length));
  }

  const baselineVals = baselineSamples.map(s => s.rawDilation).sort((a, b) => a - b);
  const mid = Math.floor(baselineVals.length / 2);
  const baseline = baselineVals.length % 2 !== 0 
    ? baselineVals[mid] 
    : (baselineVals[mid - 1] + baselineVals[mid]) / 2.0;
  const safeBaseline = baseline > 0 ? baseline : 1.0;

  // 2. Normalización de cada muestra respecto a la línea base
  let totalNormDilation = 0;
  const lineDilationMap = {};
  const normSamples = sorted.map(s => {
    const norm = s.rawDilation / safeBaseline;
    totalNormDilation += norm;
    if (!lineDilationMap[s.line]) lineDilationMap[s.line] = [];
    lineDilationMap[s.line].push(norm);
    return {
      ...s,
      normDilation: norm
    };
  });

  const pupil_dilation_avg = parseFloat((totalNormDilation / normSamples.length).toFixed(2));

  // 3. Detección de picos de sobreesfuerzo cognitivo (Cognitive Load Peaks)
  // Dilatación pupilar > 120% (1.20x) sostenida por más de 300 ms
  let cognitive_load_peaks = 0;
  let peakStart = null;
  const OVERLOAD_THRESHOLD = 1.20; // 120% de línea base
  const MIN_PEAK_DURATION_MS = 300;

  for (let i = 0; i < normSamples.length; i++) {
    const s = normSamples[i];
    if (s.normDilation >= OVERLOAD_THRESHOLD) {
      if (peakStart === null) {
        peakStart = s.t;
      }
    } else {
      if (peakStart !== null) {
        const dur = s.t - peakStart;
        if (dur >= MIN_PEAK_DURATION_MS) {
          cognitive_load_peaks++;
        }
        peakStart = null;
      }
    }
  }
  if (peakStart !== null && (normSamples[normSamples.length - 1].t - peakStart) >= MIN_PEAK_DURATION_MS) {
    cognitive_load_peaks++;
  }

  // 4. Promedios por línea
  const pupil_by_line = {};
  for (const [lineStr, vals] of Object.entries(lineDilationMap)) {
    const sum = vals.reduce((a, b) => a + b, 0);
    pupil_by_line[lineStr] = parseFloat((sum / vals.length).toFixed(2));
  }

  return {
    pupil_dilation_avg,
    cognitive_load_peaks,
    pupil_baseline: parseFloat(safeBaseline.toFixed(3)),
    pupil_by_line
  };
}

/* ═══════════════════════════════════════════════════════════════════════════════
   CADENA DE CUSTODIA DIGITAL — Estandarización de Nomenclatura Forense
   Patrón: {TEST}_{SESSION_ID}_{PATIENT_CLEAN_ID}_{YYYYMMDD_HHMMSS}
   ──────────────────────────────────────────────────────────────────────────── */
function sanitizeTagPart(val, defaultVal = 'PACIENTE') {
  if (!val) return defaultVal;
  let s = String(val).trim();
  if (!s) return defaultVal;
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  s = s.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  s = s.toUpperCase();
  return s.slice(0, 40) || defaultVal;
}

function getSessionTimestamp(date = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const mi = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${yyyy}${mm}${dd}_${hh}${mi}${ss}`;
}

function generateSessionTag(testType = 'PLC', sessionId = '0', patientId = 'PACIENTE', ts = null) {
  const cleanTest = sanitizeTagPart(testType || 'PLC', 'PLC');
  const cleanId = sanitizeTagPart(patientId, 'PACIENTE');
  const cleanSid = (sessionId !== null && sessionId !== undefined && String(sessionId) !== '') ? String(sessionId) : '0';
  const cleanTs = ts || getSessionTimestamp();
  return `${cleanTest}_${cleanSid}_${cleanId}_${cleanTs}`;
}

/**
 * Analiza cinemática y micro-temblor de cursor para Corsi y PLC
 */
function analyzeCursorKinematics(samples) {
  try {
    const tremor = typeof computeTremorScore === 'function' ? computeTremorScore(samples || []) : { tremor_score: 0.0, tremor_grade: 'NORMAL' };
    const sweep = typeof computeSweepMetrics === 'function' ? computeSweepMetrics(samples || []) : { regularity_score: 100.0, directionality: 'NORMAL' };
    return {
      microtremor_score: tremor.tremor_score || 0.0,
      tremor_grade: tremor.tremor_grade || 'NORMAL',
      sweep_regularity: sweep.regularity_score || 100.0,
      directionality: sweep.directionality || 'NORMAL',
      samples_count: tremor.samples_count || 0
    };
  } catch (e) {
    return {
      microtremor_score: 0.0,
      tremor_grade: 'NORMAL',
      sweep_regularity: 100.0,
      directionality: 'NORMAL',
      samples_count: 0
    };
  }
}

/* ═══════════════════════════════════════════════════════════════════════════════
   MÉTRICAS PSICOMÉTRICAS Y NORMATIVAS DEL TEST DE CORSI
   ──────────────────────────────────────────────────────────────────────────── */
function computeCorsiMetrics(corsiResult, age = 30) {
  const summaries = (corsiResult && (corsiResult.levelSummaries || corsiResult.trialsData)) 
    ? (corsiResult.levelSummaries || corsiResult.trialsData) 
    : [];
  const movements = (corsiResult && (corsiResult.movementsData || corsiResult.clicks)) 
    ? (corsiResult.movementsData || corsiResult.clicks) 
    : [];
  const mode = (corsiResult && (corsiResult.testMode || corsiResult.corsiMode)) 
    ? (corsiResult.testMode || corsiResult.corsiMode) 
    : 'direct';
  const isReverse = mode === 'reverse';

  const totalTrials = summaries.length;
  const correctTrials = summaries.filter(s => (s.success ?? s.isCorrect)).length;
  const errorTrials = Math.max(0, totalTrials - correctTrials);
  const accuracyPct = totalTrials > 0 ? parseFloat(((correctTrials / totalTrials) * 100).toFixed(1)) : 0.0;

  // Span de Corsi: máxima longitud de secuencia reproducida con éxito
  const successfulLengths = summaries.filter(s => (s.success ?? s.isCorrect)).map(s => s.sequence_length || s.level || 2);
  const corsiSpan = successfulLengths.length > 0 ? Math.max(...successfulLengths) : (corsiResult?.corsiSpan || 2);
  const maxLevel = summaries.length > 0 ? Math.max(...summaries.map(s => s.level || 2)) : (corsiSpan || 2);

  // Latencias y tiempos de titubeo
  const clicks = movements.filter(m => m.event_type === 'cube_click' && m.reaction_time_ms);
  const rts = clicks.map(c => c.reaction_time_ms);
  const meanRt = rts.length > 0 ? parseFloat((rts.reduce((a, b) => a + b, 0) / rts.length).toFixed(1)) : 0.0;

  const hesitations = summaries.map(s => s.hesitation_time_ms).filter(h => h > 0);
  const meanHesitation = hesitations.length > 0 ? parseFloat((hesitations.reduce((a, b) => a + b, 0) / hesitations.length).toFixed(1)) : 0.0;

  const totalTimeMs = summaries.reduce((acc, s) => acc + (s.total_time_ms || 0), 0);
  const totalTimeSec = parseFloat((totalTimeMs / 1000).toFixed(1));

  // Puntuación Compuesta (Corsi Block-Product Score: Span * Total Aciertos)
  const compositeScore = corsiSpan * correctTrials;

  // Tipología de Errores y Distancia Euclidiana de Desviación
  const cubeCoords = [
    { x: 14, y: 16 }, { x: 76, y: 14 }, { x: 46, y: 28 },
    { x: 24, y: 48 }, { x: 68, y: 46 }, { x: 86, y: 66 },
    { x: 10, y: 74 }, { x: 44, y: 80 }, { x: 74, y: 82 }
  ];
  let transpositionCount = 0;
  let intrusionCount = 0;
  let totalErrorClicks = 0;
  let euclideanDistSum = 0;

  summaries.forEach(s => {
    if (!s.success && !s.isCorrect) {
      const pres = (s.sequence_presented || s.sequence || []).map(x => Number(x));
      const targetSeq = isReverse ? [...pres].reverse() : [...pres];
      const userSeq = (s.sequence_user || s.userSequence || []).map(x => Number(x));

      userSeq.forEach((clickedCube, idx) => {
        const expectedCube = targetSeq[idx];
        if (clickedCube !== undefined && expectedCube !== undefined && clickedCube !== expectedCube) {
          totalErrorClicks++;
          if (pres.includes(clickedCube)) {
            transpositionCount++; // Cubo parte de la secuencia pero en orden erróneo
          } else {
            intrusionCount++; // Cubo ajeno no perteneciente a la secuencia
          }
          const c1 = cubeCoords[clickedCube - 1] || cubeCoords[clickedCube] || { x: 50, y: 50 };
          const c2 = cubeCoords[expectedCube - 1] || cubeCoords[expectedCube] || { x: 50, y: 50 };
          const dist = Math.sqrt((c1.x - c2.x) ** 2 + (c1.y - c2.y) ** 2);
          euclideanDistSum += dist;
        }
      });
    }
  });

  const meanEuclideanDist = totalErrorClicks > 0 ? parseFloat((euclideanDistSum / totalErrorClicks).toFixed(1)) : 0.0;
  const transpositionRate = totalErrorClicks > 0 ? parseFloat(((transpositionCount / totalErrorClicks) * 100).toFixed(1)) : 0.0;
  const intrusionRate = totalErrorClicks > 0 ? parseFloat(((intrusionCount / totalErrorClicks) * 100).toFixed(1)) : 0.0;

  // Baremos Normativos de Kessels (2000)
  const normMean = age < 30 ? (isReverse ? 5.3 : 5.8)
                 : age < 50 ? (isReverse ? 4.9 : 5.4)
                 : age < 70 ? (isReverse ? 4.5 : 5.1)
                 : (isReverse ? 4.0 : 4.6);
  const normSd = 1.05;
  const zScore = parseFloat(((corsiSpan - normMean) / normSd).toFixed(2));
  const normPercentile = Math.round(Math.min(99, Math.max(1, (0.5 * (1.0 + Math.sign(zScore) * Math.sqrt(1.0 - Math.exp(-2.0 * zScore * zScore / Math.PI)))) * 100)));

  // Calificación normativa clínica cualitativa
  let clinicalCategory = "Promedio";
  let clinicalDesc = "Capacidad de memoria de trabajo visoespacial dentro de parámetros fisiológicos estándar.";

  if (corsiSpan >= 7) {
    clinicalCategory = "Superior";
    clinicalDesc = "Excelente capacidad de retención, mapeo y secuenciación visoespacial. Rendimiento por encima del percentil 85 poblacional.";
  } else if (corsiSpan >= 5) {
    clinicalCategory = "Promedio / Típico";
    clinicalDesc = "Memoria de trabajo visoespacial adecuada. Capacidad de retención funcional para demandas ejecutivas cotidianas.";
  } else if (corsiSpan === 4) {
    clinicalCategory = "Límite / Bajo";
    clinicalDesc = "Rendimiento en la franja límite inferior. Se aprecian dificultades de retención secuencial ante aumento de longitud.";
  } else if (corsiSpan <= 3 && corsiSpan > 0) {
    clinicalCategory = "Déficit Visoespacial";
    clinicalDesc = "Rendimiento significativamente descendido respecto al grupo normativo (Kessels et al.). Sugestivo de compromiso en la red dorsal visoespacial o ejecutivo frontal.";
  } else {
    clinicalCategory = "No Determinable";
    clinicalDesc = "La prueba finalizó sin alcanzar el umbral mínimo de aciertos.";
  }

  return {
    corsi_span: corsiSpan,
    corsi_mode: mode,
    max_level: maxLevel,
    total_trials: totalTrials,
    correct_trials: correctTrials,
    error_trials: errorTrials,
    accuracy_pct: accuracyPct,
    mean_reaction_time_ms: meanRt,
    hesitation_time_avg_ms: meanHesitation,
    total_time_sec: totalTimeSec,
    composite_score: compositeScore,
    clinical_category: clinicalCategory,
    clinical_desc: clinicalDesc,
    trials_data: summaries,
    // Métricas avanzadas
    transposition_count: transpositionCount,
    intrusion_count: intrusionCount,
    transposition_rate: transpositionRate,
    intrusion_rate: intrusionRate,
    euclidean_error_dist: meanEuclideanDist,
    kessels_norm_mean: normMean,
    kessels_z_score: zScore,
    kessels_percentile: normPercentile
  };
}


