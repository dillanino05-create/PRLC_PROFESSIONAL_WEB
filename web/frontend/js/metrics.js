// metrics.js — Cálculo de métricas (portado exacto de _calc_metrics en el desktop)

function calcMetrics(linesData, clickLog, age) {
  const TA  = linesData.reduce((s, l) => s + l.aciertos,   0);
  const O   = linesData.reduce((s, l) => s + l.omisiones,  0);
  const COM = linesData.reduce((s, l) => s + l.comisiones, 0);
  const TN  = TA + O;
  const TOT = O + COM;
  const CON = TA - TOT;
  const CP  = TN > 0 ? (CON / TN) * 100 : 0;

  const times = linesData.map(l => l.tiempo_s);
  const totalTime = times.reduce((a, b) => a + b, 0);
  const meanTpl   = totalTime / times.length;
  const variance  = times.reduce((s, t) => s + (t - meanTpl) ** 2, 0) / Math.max(times.length - 1, 1);
  const stdTpl    = Math.sqrt(variance);
  const cvTime    = meanTpl > 0 ? (stdTpl / meanTpl) * 100 : 0;

  const procSpeed = totalTime > 0 ? (47 * 14 / totalTime) * 60 : 0;
  const efficiency= totalTime > 0 ? (TA / totalTime) * 60 : 0;
  const FA        = totalTime > 0 ? TA / totalTime : 0;
  const GQ        = (TN > 0 && totalTime > 0) ? (TA * TA) / (TN * totalTime) : 0;

  const hits = linesData.map(l => l.aciertos);
  const hm   = hits.reduce((a, b) => a + b, 0) / hits.length;
  const hs   = Math.sqrt(hits.reduce((s, h) => s + (h - hm) ** 2, 0) / Math.max(hits.length - 1, 1));
  const VAR       = hm > 0 ? (hs / hm) * 100 : 0;
  const estabilidad = Math.max(0, 100 - VAR);
  const consistency = Math.max(...hits) - Math.min(...hits);

  const mid = Math.floor(linesData.length / 2);
  const h1  = linesData.slice(0, mid).reduce((s, l) => s + l.aciertos, 0);
  const h2  = linesData.slice(mid).reduce((s, l) => s + l.aciertos, 0);
  const TRM = h1 > 0 ? ((h2 - h1) / h1) * 100 : 0;

  const IVR = procSpeed > 0 ? COM / (procSpeed / 100) : 0;

  // Block hits (5 blocks for MLP)
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

  // Reaction times from click log
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

  // Attention style
  let attnStyle, attnDesc;
  if (O > COM * 2) {
    attnStyle = 'Cauteloso / Lento';
    attnDesc  = 'Predominan las omisiones sobre las comisiones. El evaluado tiende a ser selectivo y lento, dejando pasar estímulos objetivo.';
  } else if (COM > O * 2) {
    attnStyle = 'Impulsivo / Rápido';
    attnDesc  = 'Predominan las comisiones. El evaluado responde rápido con bajo umbral de selección, marcando estímulos distractores.';
  } else if (CP >= 75) {
    attnStyle = 'Eficiente / Equilibrado';
    attnDesc  = 'Buen balance entre velocidad y precisión. Pocos errores en ambas direcciones.';
  } else {
    attnStyle = 'Mixto / Inestable';
    attnDesc  = 'Patrón mixto de errores. Alta variabilidad en la ejecución entre líneas.';
  }

  return {
    TA, O, COM, TN, TOT, CON, CP,
    totalTime, meanTpl, stdTpl, cvTime,
    procSpeed, efficiency, FA, GQ,
    VAR, estabilidad, consistency,
    TRM, IVR, blockHits, errorPat, adjScore,
    meanRt, medRt, attnStyle, attnDesc
  };
}

function generateNarrative(m) {
  const speedLvl = m.procSpeed > 120 ? 'superior' : m.procSpeed > 80 ? 'dentro de' : 'por debajo de';
  const cpLvl    = m.CP >= 80 ? 'alto' : m.CP >= 60 ? 'medio' : 'bajo';
  const trmTxt   = m.TRM > 5         ? 'mejora'
                 : m.TRM > -15       ? 'estable'
                 : m.TRM > -30       ? 'decaimiento moderado'
                 : 'decaimiento significativo';
  const trmSign  = m.TRM >= 0 ? '+' : '';
  return [
    `Velocidad de procesamiento: ${Math.round(m.procSpeed)} estím/min (${speedLvl} la media).`,
    `Índice de concentración CP = ${m.CP.toFixed(1)} % (${cpLvl}).`,
    `Estabilidad del rastro visual: ${Math.round(m.estabilidad)} % (VAR = ${m.VAR.toFixed(1)} %).`,
    `Resistencia a la monotonía: ${trmTxt} (TRM = ${trmSign}${m.TRM.toFixed(1)} %).`,
    `Tiempo de reacción medio por ítem: ${Math.round(m.meanRt)} ms.`,
    `Estilo atencional predominante: ${m.attnStyle}.`
  ].join('  ');
}
