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
    let mu, sigma;
    if      (age <= 18) { mu=68; sigma=14; }
    else if (age <= 35) { mu=75; sigma=12; }
    else if (age <= 50) { mu=70; sigma=13; }
    else                { mu=62; sigma=15; }

    const score = metrics.adjScore;
    const xMin  = mu - 4*sigma, xMax = mu + 4*sigma;
    const xPts  = Array.from({length:120}, (_,i) => xMin + (xMax-xMin)*i/119);
    const gaussian = x => (1/(sigma*Math.sqrt(2*Math.PI)))*Math.exp(-0.5*((x-mu)/sigma)**2);
    const yPts  = xPts.map(gaussian);

    // percentile
    const erf = z => {
      const t=1/(1+0.3275911*Math.abs(z));
      const p=1-t*(0.254829592+t*(-0.284496736+t*(1.421413741+t*(-1.453152027+t*1.061405429))))*Math.exp(-z*z);
      return z<0 ? -p : p;
    };
    const pct = Math.round((1+erf((score-mu)/(sigma*Math.sqrt(2))))/2*100);

    chartInstances.normal = new Chart(ctx, {
      type: 'line',
      data: {
        labels: xPts.map(x=>x.toFixed(1)),
        datasets: [
          { label:'Distribución normativa', data: yPts, borderColor:'#1565C0',
            backgroundColor:'rgba(21,101,192,.1)', fill:true, tension:.4, pointRadius:0, borderWidth:2.2 },
          { label:`Evaluado (CP=${score.toFixed(1)})`,
            data: xPts.map((x,i) => x <= score ? yPts[i] : null),
            borderColor:'transparent', backgroundColor:'rgba(229,57,53,.28)', fill:true,
            pointRadius:0, tension:.4 }
        ]
      },
      options: {
        responsive:true, maintainAspectRatio:false,
        plugins:{
          legend:{position:'bottom', labels:{boxWidth:12,font:{size:10}}},
          title:{display:true, text:`Curva Normativa  (Percentil ≈ ${pct})`, font:{size:12,weight:'bold'}, color:'#1A237E'},
          annotation: { annotations: {
            line1: { type:'line', xMin: xPts.findIndex(x=>x>=score), xMax: xPts.findIndex(x=>x>=score),
                     borderColor:'#E53935', borderWidth:2, borderDash:[4,4] }
          }}
        },
        scales:{
          x:{ display:false },
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
