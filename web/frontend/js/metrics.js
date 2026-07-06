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
