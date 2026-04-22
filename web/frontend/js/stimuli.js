// stimuli.js — Dibujo de estímulos PLC en HTML5 Canvas
// Traducción exacta de draw_plc_stimulus() + definición de tipos

const SW = 60, SH = 80;          // canvas size por estímulo en el test
const ARM_H = 18, ARM_V_UP = 18, ARM_V_DOWN = 18, SQ = 6;

const STIM_TYPES = {
  'T':   { is_target:true,  sq_left:true,  sq_right:true,  sq_top:false, sq_bottom:false, h_offset:0,   v_asym:0  },
  'D1':  { is_target:false, sq_left:false, sq_right:true,  sq_top:false, sq_bottom:false, h_offset:0,   v_asym:7  },
  'D2':  { is_target:false, sq_left:true,  sq_right:false, sq_top:false, sq_bottom:false, h_offset:0,   v_asym:-5 },
  'D3':  { is_target:false, sq_left:true,  sq_right:false, sq_top:false, sq_bottom:false, h_offset:9,   v_asym:0  },
  'D4':  { is_target:false, sq_left:false, sq_right:false, sq_top:false, sq_bottom:false, h_offset:0,   v_asym:0  },
  'D5':  { is_target:false, sq_left:false, sq_right:false, sq_top:true,  sq_bottom:false, h_offset:0,   v_asym:0  },
  'D6':  { is_target:false, sq_left:false, sq_right:false, sq_top:true,  sq_bottom:true,  h_offset:0,   v_asym:0  },
  'D7':  { is_target:false, sq_left:false, sq_right:true,  sq_top:false, sq_bottom:false, h_offset:-8,  v_asym:0  },
  'D8':  { is_target:false, sq_left:true,  sq_right:false, sq_top:false, sq_bottom:false, h_offset:0,   v_asym:9  },
  'D9':  { is_target:false, sq_left:false, sq_right:false, sq_top:false, sq_bottom:true,  h_offset:0,   v_asym:0  },
  'D10': { is_target:false, sq_left:false, sq_right:true,  sq_top:false, sq_bottom:false, h_offset:-10, v_asym:4  },
  'D11': { is_target:false, sq_left:true,  sq_right:false, sq_top:false, sq_bottom:true,  h_offset:0,   v_asym:-3 },
  'D12': { is_target:false, sq_left:false, sq_right:false, sq_top:false, sq_bottom:false, h_offset:0,   v_asym:12 },
  'D13': { is_target:false, sq_left:true,  sq_right:true,  sq_top:false, sq_bottom:false, h_offset:0,   v_asym:8  },
  'D14': { is_target:false, sq_left:true,  sq_right:true,  sq_top:false, sq_bottom:false, h_offset:0,   v_asym:-8 },
};

const DISTRACTOR_KEYS    = ['D1','D2','D3','D4','D5','D6','D7','D8','D9','D10','D11','D12','D13','D14'];
const DISTRACTOR_WEIGHTS = [ 10,  10,   9,   9,   9,   8,   9,   9,   8,    8,    6,    5,   10,   10];

/**
 * Dibuja el estímulo PLC en un CanvasRenderingContext2D.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} stype — STIM_TYPES entry
 * @param {number} w, h  — canvas dimensions
 * @param {string} fg    — foreground color
 * @param {string} bg    — background color
 * @param {number} lw    — line width
 */
function drawPLCStimulus(ctx, stype, w, h, fg = '#1A1A2E', bg = '#FFFFFF', lw = 1.8) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const cx  = w / 2;
  const cy  = h / 2 + (stype.h_offset || 0);
  const va  = stype.v_asym || 0;
  const s   = SQ;

  ctx.strokeStyle = fg;
  ctx.fillStyle   = fg;
  ctx.lineWidth   = lw;
  ctx.lineCap     = 'round';

  // Vertical line
  ctx.beginPath();
  ctx.moveTo(cx, cy - ARM_V_UP - va);
  ctx.lineTo(cx, cy + ARM_V_DOWN);
  ctx.stroke();

  // Horizontal line
  const lx = cx - ARM_H, rx = cx + ARM_H;
  ctx.beginPath();
  ctx.moveTo(lx, cy);
  ctx.lineTo(rx, cy);
  ctx.stroke();

  // Squares
  function sq(x, y) {
    ctx.fillRect(x - s / 2, y - s / 2, s, s);
  }
  if (stype.sq_left)   sq(lx, cy);
  if (stype.sq_right)  sq(rx, cy);
  if (stype.sq_top)    sq(cx, cy - ARM_V_UP - va);
  if (stype.sq_bottom) sq(cx, cy + ARM_V_DOWN);
}

// Weighted random distractor
function weightedRandom(keys, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < keys.length; i++) {
    r -= weights[i];
    if (r <= 0) return keys[i];
  }
  return keys[keys.length - 1];
}

// Fisher–Yates shuffle
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Generate one test line: nTargets(8-12) + rest distractors
function generateTestLine(N = 47) {
  const nT  = 8 + Math.floor(Math.random() * 5);
  const pos  = shuffle([...Array(N).keys()]);
  const tSet = new Set(pos.slice(0, nT));
  return Array.from({ length: N }, (_, i) => {
    const key = tSet.has(i) ? 'T' : weightedRandom(DISTRACTOR_KEYS, DISTRACTOR_WEIGHTS);
    return { key, pos: i, ...STIM_TYPES[key] };
  });
}

// Generate practice line: exactly 2 targets, (n-2) varied distractors
// Ahora permite forzar llaves específicas para entrenamiento
function generatePracticeLine(n = 10, mandatoryDists = []) {
  const dists = [...mandatoryDists];
  
  while (dists.length < n - 2) {
    dists.push(weightedRandom(DISTRACTOR_KEYS, DISTRACTOR_WEIGHTS));
  }
  
  // Ensure variety
  while (new Set(dists).size < Math.min(4, n - 2)) {
    dists[Math.floor(Math.random() * dists.length)] =
      DISTRACTOR_KEYS[Math.floor(Math.random() * DISTRACTOR_KEYS.length)];
  }
  
  const combined = ['T', 'T', ...dists];
  shuffle(combined);
  return combined.map(k => ({ key: k, ...STIM_TYPES[k] }));
}
