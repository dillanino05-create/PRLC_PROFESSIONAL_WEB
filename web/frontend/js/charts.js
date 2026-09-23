// charts.js — Chart.js renderers (equivalentes a los 4 subplots matplotlib del desktop)

let chartInstances = {};

function destroyCharts() {
  Object.values(chartInstances).forEach(c => { try { c.destroy(); } catch(e){} });
  chartInstances = {};
}

function renderResultCharts(linesData, metrics, mlPred) {
  destroyCharts();

  const lineas = linesData.map(l => l.linea);
  const hits   = linesData.map(l => l.aciertos);
  const oms    = linesData.map(l => l.omisiones);
  const coms   = linesData.map(l => l.comisiones);

  // ── Chart 1: Curva de comportamiento ─────────────────────────────────
  {
    const ctx = document.getElementById('chart-behavior').getContext('2d');
    // Trend line via linear regression
    const n  = lineas.length;
    const sx = lineas.reduce((a,b)=>a+b,0), sy = hits.reduce((a,b)=>a+b,0);
    const sxy= lineas.reduce((s,x,i)=>s+x*hits[i],0);
    const sx2= lineas.reduce((s,x)=>s+x*x,0);
    const m  = (n*sxy - sx*sy) / (n*sx2 - sx*sx || 1);
    const b  = (sy - m*sx) / n;
    const trend = lineas.map(x => +(m*x+b).toFixed(2));

    chartInstances.behavior = new Chart(ctx, {
      data: {
        labels: lineas,
        datasets: [
          { type:'line', label:'Aciertos', data: hits,
            borderColor:'#1565C0', backgroundColor:'rgba(21,101,192,.1)',
            fill:true, tension:.35, pointRadius:4, pointBackgroundColor:'#1565C0', borderWidth:2.2 },
          { type:'line', label:'Tendencia', data: trend,
            borderColor:'#E53935', borderDash:[6,4], pointRadius:0, borderWidth:1.6, fill:false }
        ]
      },
      options: {
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{position:'bottom', labels:{boxWidth:12,font:{size:10}}},
                  title:{display:true, text:'Curva de Comportamiento', font:{size:12,weight:'bold'}, color:'#1A237E'}},
        scales:{
          x:{ title:{display:true, text:'Línea'}, grid:{color:'rgba(0,0,0,.05)'} },
          y:{ title:{display:true, text:'Aciertos'}, grid:{color:'rgba(0,0,0,.05)'}, beginAtZero:true }
        }
      }
    });
  }

  // ── Chart 2: Métricas de atención (barras) ────────────────────────────
  {
    const ctx = document.getElementById('chart-metrics').getContext('2d');
    chartInstances.metrics = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Aciertos (TA)', 'Omisiones (O)', 'Comisiones (C)', 'Índice CP %'],
        datasets: [{ data: [metrics.TA, metrics.O, metrics.COM, +metrics.CP.toFixed(1)],
          backgroundColor: ['#1565C0','#E65100','#B71C1C','#2E7D32'],
          borderRadius: 6, borderSkipped: false }]
      },
      options: {
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{display:false},
                  title:{display:true, text:'Métricas de Atención', font:{size:12,weight:'bold'}, color:'#1A237E'},
                  datalabels: false },
        scales:{
          x:{ grid:{display:false} },
          y:{ beginAtZero:true, grid:{color:'rgba(0,0,0,.05)'} }
        }
      }
    });
  }

  // ── Chart 3: Errores por línea ────────────────────────────────────────
  {
    const ctx = document.getElementById('chart-errors').getContext('2d');
    chartInstances.errors = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: lineas,
        datasets: [
          { label:'Omisiones',  data: oms,  backgroundColor:'rgba(230,81,0,.82)',  borderRadius:3 },
          { label:'Comisiones', data: coms, backgroundColor:'rgba(183,28,28,.82)', borderRadius:3 }
        ]
      },
      options: {
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{position:'bottom', labels:{boxWidth:12,font:{size:10}}},
                  title:{display:true, text:'Errores por Línea', font:{size:12,weight:'bold'}, color:'#1A237E'} },
        scales:{
          x:{ title:{display:true, text:'Línea'}, grid:{display:false} },
          y:{ title:{display:true, text:'Errores'}, beginAtZero:true, grid:{color:'rgba(0,0,0,.05)'} }
        }
      }
    });
  }

  // ── Chart 4: Curva de normalidad (Gauss) ──────────────────────────────
  {
    const ctx = document.getElementById('chart-normal').getContext('2d');
    const age = metrics._age || 25;
    const mu = metrics.con_norm_mean || 180.39;
    const sigma = metrics.con_norm_sd || 40.5;
    const score = metrics.CON !== undefined ? metrics.CON : (metrics.adjScore || 133);

    const xMin  = Math.max(0, mu - 3.5 * sigma), xMax = mu + 3.5 * sigma;
    const xPts  = Array.from({length:120}, (_,i) => xMin + (xMax-xMin)*i/119);
    const gaussian = x => (1/(sigma*Math.sqrt(2*Math.PI)))*Math.exp(-0.5*((x-mu)/sigma)**2);
    const yPts  = xPts.map(gaussian);

    const zScore = parseFloat(((score - mu) / sigma).toFixed(2));
    const erf = z => {
      const t=1/(1+0.3275911*Math.abs(z));
      const p=1-t*(0.254829592+t*(-0.284496736+t*(1.421413741+t*(-1.453152027+t*1.061405429))))*Math.exp(-z*z);
      return z<0 ? -p : p;
    };
    const pct = Math.min(99, Math.max(1, Math.round((1+erf(zScore/Math.sqrt(2)))/2*100)));
    const zSign = zScore >= 0 ? '+' : '';

    chartInstances.normal = new Chart(ctx, {
      type: 'line',
      data: {
        labels: xPts.map(x=>Math.round(x)),
        datasets: [
          { label:`Norma ${metrics.d2_norm_stratum || 'Adultos'} (μ=${mu.toFixed(1)}, σ=${sigma.toFixed(1)})`, data: yPts, borderColor:'#1565C0',
            backgroundColor:'rgba(21,101,192,.1)', fill:true, tension:.4, pointRadius:0, borderWidth:2.2 },
          { label:`Evaluado (CON=${score}, Z=${zSign}${zScore})`,
            data: xPts.map((x,i) => x <= score ? yPts[i] : null),
            borderColor:'transparent', backgroundColor:'rgba(229,57,53,.28)', fill:true,
            pointRadius:0, tension:.4 }
        ]
      },
      options: {
        responsive:true, maintainAspectRatio:false,
        plugins:{
          legend:{position:'bottom', labels:{boxWidth:12,font:{size:10}}},
          title:{display:true, text:`Curva Normativa d2 — CON: ${score} (Percentil ≈ P${pct}, Z = ${zSign}${zScore})`, font:{size:12,weight:'bold'}, color:'#1A237E'}
        },
        scales:{
          x:{ title:{display:true, text:'Puntuación de Concentración (CON = TA - C)'}, ticks:{maxTicksLimit:8} },
          y:{ display:false, beginAtZero:true }
        }
      }
    });
  }

  // ── Chart 5: Saltos Erráticos ──────────────────────────────
  {
    const ctx = document.getElementById('chart-jumps');
    if (ctx) {
      const jumps = linesData.map(l => l.saltos_erraticos || 0);
      chartInstances.jumps = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
          labels: lineas,
          datasets: [
            { label:'Saltos/Retrocesos', data: jumps, borderColor:'#F57F17',
              backgroundColor:'rgba(245,127,23,.1)', fill:true, tension:.3, pointRadius:4, pointBackgroundColor:'#F57F17', borderWidth:2 }
          ]
        },
        options: {
          responsive:true, maintainAspectRatio:false,
          plugins:{
            legend:{display:false},
            title:{display:true, text:'Saltos Visuales Erráticos por Línea', font:{size:12,weight:'bold'}, color:'#1A237E'}
          },
          scales:{
            x:{ title:{display:true, text:'Línea'}, grid:{color:'rgba(0,0,0,.05)'} },
            y:{ title:{display:true, text:'Cant. Saltos'}, beginAtZero:true, grid:{color:'rgba(0,0,0,.05)'}, ticks:{stepSize:1} }
          }
        }
      });
    }
  }
}

/**
 * ── Renderizador de Gráficas para el Test de Bloques de Corsi ─────────────
 * Genera los 5 gráficos analíticos:
 * 1. Curva de Progresión Visoespacial (Nivel y Éxito/Fallo)
 * 2. Cronometría Cognitiva: Duda Previa (Hesitation) vs TR Medio
 * 3. Distribución de Éxito vs Error (Precisión Global)
 * 4. Campana Normativa de Span Visoespacial (Gauss poblacional)
 * 5. Cinemática Motora y Temblor del Cursor por Ensayo
 */
function renderCorsiResultCharts(trialsData, metrics, mlPred) {
  destroyCharts();

  const trials = Array.isArray(trialsData) ? trialsData : [];
  const labels = trials.map((t, idx) => `E${idx + 1} (N${t.sequence_length || t.level || 2})`);
  const levels = trials.map(t => t.sequence_length || t.level || 2);
  const hits   = trials.map(t => (t.success !== undefined ? t.success : t.isCorrect) ? 1 : 0);
  const hesitations = trials.map(t => Math.round(t.hesitation_time_ms || t.hesitationTimeMs || 0));
  const rts = trials.map(t => Math.round(t.mean_reaction_time_ms || t.meanReactionTimeMs || 0));
  const tremors = trials.map(t => +(t.tremor_score || 0).toFixed(1));

  // ── Chart 1: Progresión Visoespacial (Nivel y Éxito) ─────────────────
  const ctxProg = document.getElementById('chart-behavior');
  if (ctxProg) {
    chartInstances.behavior = new Chart(ctxProg.getContext('2d'), {
      data: {
        labels: labels,
        datasets: [
          {
            type: 'line',
            label: 'Nivel Evaluado (Bloques)',
            data: levels,
            borderColor: '#3949AB',
            backgroundColor: 'rgba(57, 73, 171, 0.1)',
            fill: true,
            tension: 0.2,
            pointRadius: 6,
            pointBackgroundColor: hits.map(h => h === 1 ? '#2E7D32' : '#C62828'),
            pointBorderColor: '#FFFFFF',
            pointBorderWidth: 2,
            borderWidth: 2.5
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } },
          title: { display: true, text: 'Curva de Progresión Visoespacial (● Verde: Acierto / ● Rojo: Error)', font: { size: 12, weight: 'bold' }, color: '#1A237E' }
        },
        scales: {
          x: { title: { display: true, text: 'Ensayo (Nivel)' }, grid: { color: 'rgba(0,0,0,.05)' } },
          y: { title: { display: true, text: 'Cantidad de Bloques' }, beginAtZero: true, min: 1, max: 10, ticks: { stepSize: 1 }, grid: { color: 'rgba(0,0,0,.05)' } }
        }
      }
    });
  }

  // ── Chart 2: Cronometría Cognitiva (Duda Inicial vs TR Medio) ───────────
  const ctxTiming = document.getElementById('chart-metrics');
  if (ctxTiming) {
    chartInstances.metrics = new Chart(ctxTiming.getContext('2d'), {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          { label: 'Duda Previa (Hesitation ms)', data: hesitations, backgroundColor: 'rgba(239, 108, 0, 0.85)', borderRadius: 4 },
          { label: 'TR Medio por Bloque (ms)', data: rts, backgroundColor: 'rgba(21, 101, 192, 0.85)', borderRadius: 4 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } },
          title: { display: true, text: 'Cronometría: Duda Previa vs TR Medio (ms)', font: { size: 12, weight: 'bold' }, color: '#1A237E' }
        },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, title: { display: true, text: 'Milisegundos (ms)' }, grid: { color: 'rgba(0,0,0,.05)' } }
        }
      }
    });
  }

  // ── Chart 3: Distribución de Aciertos vs Errores ────────────────────────
  const ctxAcc = document.getElementById('chart-errors');
  if (ctxAcc) {
    const totalCorrect = metrics.correct_trials || hits.filter(h => h === 1).length;
    const totalErrors = metrics.error_trials || (hits.length - totalCorrect);
    chartInstances.errors = new Chart(ctxAcc.getContext('2d'), {
      type: 'bar',
      data: {
        labels: ['Correctos (Éxito)', 'Errores (Fallo)'],
        datasets: [{
          data: [totalCorrect, totalErrors],
          backgroundColor: ['#2E7D32', '#C62828'],
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          title: { display: true, text: `Precisión Global: ${metrics.accuracy_pct?.toFixed(1) || 0}%`, font: { size: 12, weight: 'bold' }, color: '#1A237E' }
        },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: 'rgba(0,0,0,.05)' } }
        }
      }
    });
  }

  // ── Chart 4: Curva Normativa de Span Visoespacial (Gauss) ───────────────
  const ctxNorm = document.getElementById('chart-normal');
  if (ctxNorm) {
    const isDual = metrics.corsi_mode === 'dual' || metrics.dual === true;
    const isReverse = metrics.corsi_mode === 'reverse';
    const mu = metrics.kessels_norm_mean || (isReverse ? 4.8 : 5.4);
    const sigma = metrics.kessels_norm_sd || (isReverse ? 1.0 : 1.1);
    const score = Number(metrics.corsi_span) || 4;

    const xMin = Math.max(1.0, mu - 3.5 * sigma), xMax = Math.min(10.0, mu + 3.5 * sigma);
    const xPts = Array.from({ length: 80 }, (_, i) => xMin + (xMax - xMin) * i / 79);
    const gaussian = x => (1 / (sigma * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * ((x - mu) / sigma) ** 2);
    const yPts = xPts.map(gaussian);

    const erf = z => {
      const t = 1 / (1 + 0.3275911 * Math.abs(z));
      const p = 1 - t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) * Math.exp(-z * z);
      return z < 0 ? -p : p;
    };
    const zScore = parseFloat(((score - mu) / sigma).toFixed(2));
    const pct = Math.min(99, Math.max(1, Math.round((1 + erf(zScore / Math.sqrt(2))) / 2 * 100)));
    const zSign = zScore >= 0 ? '+' : '';
    const stratumLabel = metrics.age_norm_stratum || 'Adultos';

    chartInstances.normal = new Chart(ctxNorm.getContext('2d'), {
      type: 'line',
      data: {
        labels: xPts.map(x => x.toFixed(1)),
        datasets: [
          {
            label: `Baremos Kessels — ${stratumLabel} (μ=${mu.toFixed(1)}, σ=${sigma.toFixed(1)})`,
            data: yPts,
            borderColor: '#5C6BC0',
            backgroundColor: 'rgba(92, 107, 192, 0.15)',
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            borderWidth: 2
          },
          {
            label: `Evaluado (Span=${score} bloques, Z=${zSign}${zScore})`,
            data: xPts.map((x, i) => x <= score ? yPts[i] : null),
            borderColor: 'transparent',
            backgroundColor: 'rgba(239, 108, 0, 0.35)',
            fill: true,
            pointRadius: 0,
            tension: 0.4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } },
          title: { display: true, text: `Campana Normativa Corsi — Span: ${score} (Percentil ≈ P${pct}, Z = ${zSign}${zScore})`, font: { size: 12, weight: 'bold' }, color: '#1A237E' }
        },
        scales: {
          x: { title: { display: true, text: 'Span de Bloques Visoespacial' }, ticks: { maxTicksLimit: 9 } },
          y: { display: false, beginAtZero: true }
        }
      }
    });
  }

  // ── Chart 5: Cinemática Motora y Temblor del Mouse por Ensayo ───────────
  const ctxJumps = document.getElementById('chart-jumps');
  if (ctxJumps) {
    chartInstances.jumps = new Chart(ctxJumps.getContext('2d'), {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Micro-temblor Motor (Jitter px/s²)',
            data: tremors,
            borderColor: '#7B1FA2',
            backgroundColor: 'rgba(123, 31, 162, 0.1)',
            fill: true,
            tension: 0.3,
            pointRadius: 5,
            pointBackgroundColor: '#7B1FA2',
            borderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } },
          title: { display: true, text: 'Dinámica Motora: Estabilidad del Trazo del Cursor por Ensayo', font: { size: 12, weight: 'bold' }, color: '#1A237E' }
        },
        scales: {
          x: { title: { display: true, text: 'Ensayo' }, grid: { color: 'rgba(0,0,0,.05)' } },
          y: { title: { display: true, text: 'Jitter (px/s²)' }, beginAtZero: true, grid: { color: 'rgba(0,0,0,.05)' } }
        }
      }
    });
  }
}
