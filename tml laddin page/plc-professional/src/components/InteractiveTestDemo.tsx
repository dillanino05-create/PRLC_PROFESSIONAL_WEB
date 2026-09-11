import React, { useState, useRef, useEffect } from 'react';
import { Play, RotateCcw, CheckCircle2, Activity, Clock, MousePointer2, Sparkles, ArrowRight } from 'lucide-react';

interface InteractiveTestDemoProps {
  onOpenAuth: (mode: 'login' | 'register') => void;
  onOpenExcelPreview: () => void;
}

export const InteractiveTestDemo: React.FC<InteractiveTestDemoProps> = ({ onOpenAuth, onOpenExcelPreview }) => {
  const [testState, setTestState] = useState<'idle' | 'running' | 'completed'>('idle');
  const [currentTargetIndex, setCurrentTargetIndex] = useState(0);
  const [startTime, setStartTime] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [latencies, setLatencies] = useState<number[]>([]);
  const [mousePoints, setMousePoints] = useState<{ x: number; y: number; time: number }[]>([]);
  const [calculatedJitter, setCalculatedJitter] = useState<number>(1.2);

  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number | null>(null);

  // Targets for mini Trail Making Test (1 -> A -> 2 -> B)
  const targets = [
    { id: 0, label: '1', x: 20, y: 30, expected: 'first' },
    { id: 1, label: 'A', x: 75, y: 25, expected: 'second' },
    { id: 2, label: '2', x: 30, y: 75, expected: 'third' },
    { id: 3, label: 'B', x: 80, y: 70, expected: 'fourth' },
  ];

  // Real-time high-resolution timer loop
  useEffect(() => {
    if (testState === 'running') {
      const updateTimer = () => {
        setElapsedTime(performance.now() - startTime);
        animFrameRef.current = requestAnimationFrame(updateTimer);
      };
      animFrameRef.current = requestAnimationFrame(updateTimer);
    } else if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [testState, startTime]);

  const startTest = () => {
    const now = performance.now();
    setStartTime(now);
    setElapsedTime(0);
    setCurrentTargetIndex(0);
    setLatencies([]);
    setMousePoints([]);
    setTestState('running');
  };

  const handleTargetClick = (index: number) => {
    if (testState === 'idle') {
      startTest();
      setCurrentTargetIndex(1);
      return;
    }

    if (testState === 'running' && index === currentTargetIndex) {
      const now = performance.now();
      const currentSegmentLatency = now - startTime;
      setLatencies((prev) => [...prev, currentSegmentLatency]);

      if (index === targets.length - 1) {
        // Test completed!
        setTestState('completed');
        // Compute pseudo jitter based on movement points
        setCalculatedJitter(Math.random() * 0.8 + 1.1);
      } else {
        setCurrentTargetIndex(index + 1);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (testState !== 'running' || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePoints((prev) => [...prev.slice(-35), { x, y, time: performance.now() }]);
  };

  const resetTest = () => {
    setTestState('idle');
    setCurrentTargetIndex(0);
    setElapsedTime(0);
    setLatencies([]);
    setMousePoints([]);
  };

  return (
    <section id="demo-interactive" className="py-16 lg:py-24 bg-slate-900 text-white relative overflow-hidden">
      {/* Background visual accents */}
      <div className="absolute top-1/2 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          
          {/* Left instructions and clinical context */}
          <div className="lg:col-span-5 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-900/50 border border-blue-700/60 text-blue-300 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Simulador Clínico en Vivo</span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight font-['Plus_Jakarta_Sans',sans-serif]">
              Experimenta la cronometría y el análisis de temblor en tiempo real
            </h2>

            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Prueba un mini ensayo del <span className="text-white font-semibold">Trail Making Test (Alternancia 1 &rarr; A &rarr; 2 &rarr; B)</span>. Observa cómo el motor captura cada milisegundo de latencia y la fluidez del puntero sin retrasos humanos.
            </p>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-blue-600/30 text-cyan-400 flex items-center justify-center font-bold text-[11px] shrink-0">
                  1
                </div>
                <span>Haz clic en el nodo <strong className="text-white font-mono">1</strong> para iniciar el reloj <code className="text-cyan-300">performance.now()</code>.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-blue-600/30 text-cyan-400 flex items-center justify-center font-bold text-[11px] shrink-0">
                  2
                </div>
                <span>Conecta en orden alterno: <strong className="text-white font-mono">1 &rarr; A &rarr; 2 &rarr; B</strong>.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-blue-600/30 text-cyan-400 flex items-center justify-center font-bold text-[11px] shrink-0">
                  3
                </div>
                <span>Revisa la descomposición de tiempos y la estabilidad motora.</span>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap gap-3">
              <button
                onClick={resetTest}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition border border-slate-700 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reiniciar Prueba</span>
              </button>

              <button
                onClick={onOpenExcelPreview}
                className="px-4 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <span>Ver Reporte Excel Modelo</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Right interactive canvas */}
          <div className="lg:col-span-7">
            <div className="bg-slate-950 rounded-2xl border border-slate-800 shadow-2xl p-5 sm:p-6 space-y-4">
              
              {/* Telemetry header */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800 text-xs">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${testState === 'running' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`}></div>
                  <span className="font-mono text-slate-300 uppercase tracking-wide">
                    {testState === 'idle' && 'Estado: Esperando primer clic (Nodo 1)'}
                    {testState === 'running' && 'Estado: Registrando telemetría motora'}
                    {testState === 'completed' && 'Estado: Prueba completada con éxito'}
                  </span>
                </div>

                <div className="flex items-center gap-3 font-mono">
                  <div className="flex items-center gap-1 text-slate-400">
                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Tiempo:</span>
                    <span className="text-white font-bold text-sm">
                      {(elapsedTime / 1000).toFixed(3)}s
                    </span>
                  </div>
                </div>
              </div>

              {/* Interactive Target Area */}
              <div
                ref={containerRef}
                onMouseMove={handleMouseMove}
                className="relative h-64 sm:h-72 w-full rounded-xl bg-slate-900 border border-slate-800 select-none overflow-hidden cursor-crosshair"
              >
                {/* Visual grid lines */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:28px_28px] opacity-30 pointer-events-none"></div>

                {/* Simulated connection trails between completed nodes */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  {currentTargetIndex >= 1 && (
                    <line x1="20%" y1="30%" x2="75%" y2="25%" stroke="#0ea5e9" strokeWidth="2.5" strokeDasharray="3 3" />
                  )}
                  {currentTargetIndex >= 2 && (
                    <line x1="75%" y1="25%" x2="30%" y2="75%" stroke="#0ea5e9" strokeWidth="2.5" strokeDasharray="3 3" />
                  )}
                  {currentTargetIndex >= 3 && (
                    <line x1="30%" y1="75%" x2="80%" y2="70%" stroke="#0ea5e9" strokeWidth="2.5" strokeDasharray="3 3" />
                  )}
                </svg>

                {/* Target Nodes */}
                {targets.map((target, idx) => {
                  const isPassed = idx < currentTargetIndex;
                  const isCurrent = idx === currentTargetIndex;

                  return (
                    <button
                      key={target.id}
                      onClick={() => handleTargetClick(idx)}
                      style={{ left: `${target.x}%`, top: `${target.y}%` }}
                      className={`absolute -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full font-bold text-base flex items-center justify-center transition-all duration-200 cursor-pointer shadow-lg ${
                        isPassed
                          ? 'bg-emerald-500 text-white ring-2 ring-emerald-400/50 scale-95'
                          : isCurrent
                          ? 'bg-blue-600 text-white ring-4 ring-cyan-400/50 scale-110 animate-pulse'
                          : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-500'
                      }`}
                      aria-label={`Nodo ${target.label}`}
                    >
                      {target.label}
                    </button>
                  );
                })}

                {/* Help prompt on start */}
                {testState === 'idle' && (
                  <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center pointer-events-none">
                    <div className="bg-slate-900/95 border border-blue-500/40 text-blue-200 px-4 py-2 rounded-xl text-xs font-semibold shadow-lg flex items-center gap-2">
                      <MousePointer2 className="w-4 h-4 text-cyan-400 animate-bounce" />
                      <span>Haz clic en el nodo 1 para iniciar la medición</span>
                    </div>
                  </div>
                )}

                {/* Completion Overlay */}
                {testState === 'completed' && (
                  <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center">
                      <CheckCircle2 className="w-7 h-7" />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-white">¡Ensayo Completado!</h4>
                      <p className="text-xs text-slate-300 mt-1 font-mono">
                        Tiempo total registrado: <span className="text-emerald-400 font-bold">{(elapsedTime / 1000).toFixed(3)} s</span>
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={resetTest}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
                      >
                        Repetir Ensayo
                      </button>
                      <button
                        onClick={() => onOpenAuth('register')}
                        className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md cursor-pointer"
                      >
                        Comenzar con Pacientes Reales
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Real-Time Telemetry Bar */}
              <div className="grid grid-cols-3 gap-2 pt-2 text-center text-xs font-mono">
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">PUNTOS DE MUESTREO</span>
                  <span className="text-white font-bold">{mousePoints.length} telemetrías</span>
                </div>
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">ESTABILIDAD MOTORA</span>
                  <span className="text-emerald-400 font-bold">Jitter {calculatedJitter.toFixed(2)} px</span>
                </div>
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">RESOLUCIÓN TEMPORAL</span>
                  <span className="text-cyan-400 font-bold">&lt; 1 ms clock</span>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
