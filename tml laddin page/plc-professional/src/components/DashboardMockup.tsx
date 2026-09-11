import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Clock, 
  FileSpreadsheet, 
  Shield, 
  CheckCircle, 
  Play, 
  RotateCcw, 
  TrendingUp, 
  UserCheck, 
  MousePointer2, 
  Download,
  AlertCircle
} from 'lucide-react';

interface DashboardMockupProps {
  onOpenExcelPreview?: () => void;
  onOpenDemo?: () => void;
}

export const DashboardMockup: React.FC<DashboardMockupProps> = ({ 
  onOpenExcelPreview, 
  onOpenDemo 
}) => {
  const [activeTab, setActiveTab] = useState<'canvas' | 'tremor' | 'report'>('canvas');
  const [isRunningSim, setIsRunningSim] = useState(true);
  const [timerMs, setTimerMs] = useState(3842);
  const [activeNode, setActiveNode] = useState(3);
  const [cursorPos, setCursorPos] = useState({ x: 195, y: 145 });

  // Simulated live execution loop
  useEffect(() => {
    if (!isRunningSim) return;
    const interval = setInterval(() => {
      setTimerMs((prev) => (prev >= 6200 ? 1200 : prev + 120));
      setActiveNode((prev) => (prev >= 5 ? 1 : prev + 1));
    }, 1800);
    return () => clearInterval(interval);
  }, [isRunningSim]);

  // Coordinate trajectory nodes for Trail Making Test mockup
  const nodes = [
    { id: 1, label: '1', x: 45, y: 40, status: 'completed' },
    { id: 2, label: 'A', x: 110, y: 85, status: 'completed' },
    { id: 3, label: '2', x: 200, y: 55, status: activeNode >= 3 ? 'completed' : 'pending' },
    { id: 4, label: 'B', x: 270, y: 115, status: activeNode >= 4 ? 'completed' : 'current' },
    { id: 5, label: '3', x: 190, y: 175, status: activeNode >= 5 ? 'completed' : 'pending' },
    { id: 6, label: 'C', x: 80, y: 160, status: 'pending' },
  ];

  return (
    <div 
      id="hero-dashboard-mockup" 
      className="relative mx-auto w-full max-w-xl lg:max-w-none rounded-2xl bg-white/95 border border-slate-200/90 shadow-2xl shadow-blue-900/10 backdrop-blur-sm overflow-hidden transition-all"
    >
      {/* Chrome Window Header */}
      <div className="bg-slate-900 text-white px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block"></span>
          </div>
          <div className="h-4 w-px bg-slate-700"></div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-500/20 text-blue-300 border border-blue-400/30">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
              Sesión Activa
            </span>
            <span className="text-xs text-slate-300 font-mono hidden sm:inline">
              PLC-Engine v4.2 • Protocolo TMT-B
            </span>
          </div>
        </div>

        {/* Security & RLS indicator */}
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden sm:inline font-mono">RLS: Dra. Valenzuela</span>
          <span className="text-emerald-400 font-semibold font-mono">HIPAA</span>
        </div>
      </div>

      {/* Patient Header Bar */}
      <div className="bg-slate-50/90 px-4 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
            EM
          </div>
          <div>
            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
              <span>Elena Morales</span>
              <span className="text-slate-400 font-normal">| 68 años</span>
              <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-mono">ID: #NP-8842</span>
            </div>
            <span className="text-[11px] text-slate-500">Escolaridad: 12a • Lateralidad: Diestra</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button 
            onClick={() => setIsRunningSim(!isRunningSim)}
            className="px-2.5 py-1 rounded bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 flex items-center gap-1 text-[11px] font-medium transition cursor-pointer"
            title={isRunningSim ? "Pausar animación" : "Reanudar animación"}
          >
            {isRunningSim ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                <span>Pausar</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3 text-blue-600 fill-blue-600" />
                <span>Simular</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Sub-navigation tabs */}
      <div className="flex border-b border-slate-200 bg-white px-4 pt-2 gap-2 text-xs font-medium">
        <button
          onClick={() => setActiveTab('canvas')}
          className={`pb-2 px-3 border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'canvas'
              ? 'border-blue-600 text-blue-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <MousePointer2 className="w-3.5 h-3.5" />
          <span>Canvas Milisegundos</span>
        </button>

        <button
          onClick={() => setActiveTab('tremor')}
          className={`pb-2 px-3 border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'tremor'
              ? 'border-blue-600 text-blue-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Activity className="w-3.5 h-3.5 text-blue-500" />
          <span>Biomarcador Temblor</span>
        </button>

        <button
          onClick={() => setActiveTab('report')}
          className={`pb-2 px-3 border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'report'
              ? 'border-blue-600 text-blue-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
          <span>Reporte Excel Clínico</span>
        </button>
      </div>

      {/* Interactive Content Area */}
      <div className="p-4 sm:p-5 bg-gradient-to-b from-white to-slate-50 min-h-[290px] flex flex-col justify-between">
        {activeTab === 'canvas' && (
          <div className="space-y-3">
            {/* Live Telemetry Row */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-slate-50 rounded-lg p-2 border border-slate-200/80">
                <div className="flex items-center gap-1 text-[10px] uppercase font-semibold text-slate-400">
                  <Clock className="w-3 h-3 text-blue-500" />
                  <span>Tiempo Total</span>
                </div>
                <div className="text-base sm:text-lg font-bold font-mono text-slate-900 mt-0.5">
                  {(timerMs / 1000).toFixed(3)}s
                </div>
                <span className="text-[10px] text-blue-600 font-mono">±0.4ms precisión</span>
              </div>

              <div className="bg-slate-50 rounded-lg p-2 border border-slate-200/80">
                <div className="flex items-center gap-1 text-[10px] uppercase font-semibold text-slate-400">
                  <Activity className="w-3 h-3 text-emerald-500" />
                  <span>Latencia Nodal</span>
                </div>
                <div className="text-base sm:text-lg font-bold font-mono text-slate-900 mt-0.5">
                  246 ms
                </div>
                <span className="text-[10px] text-emerald-600 font-medium">Percentil: 68 (Normal)</span>
              </div>

              <div className="bg-slate-50 rounded-lg p-2 border border-slate-200/80">
                <div className="flex items-center gap-1 text-[10px] uppercase font-semibold text-slate-400">
                  <TrendingUp className="w-3 h-3 text-cyan-500" />
                  <span>Vel. Cursor</span>
                </div>
                <div className="text-base sm:text-lg font-bold font-mono text-slate-900 mt-0.5">
                  342 px/s
                </div>
                <span className="text-[10px] text-slate-500 font-mono">Jitter: 1.2px</span>
              </div>
            </div>

            {/* Interactive Simulated Canvas Screen */}
            <div className="relative h-44 rounded-xl bg-slate-900 border border-slate-800 overflow-hidden shadow-inner flex items-center justify-center">
              {/* Grid lines */}
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:24px_24px] opacity-40"></div>

              {/* Trajectory lines */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                <polyline
                  points="45,40 110,85 200,55 270,115"
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="2.5"
                  strokeDasharray="4 2"
                  className="opacity-80"
                />
                <circle cx="270" cy="115" r="16" fill="rgba(56, 189, 248, 0.15)" stroke="#38bdf8" strokeWidth="1.5" />
              </svg>

              {/* TMT Nodes */}
              {nodes.map((node) => {
                const isReached = node.id < activeNode;
                const isCurrent = node.id === activeNode;
                return (
                  <div
                    key={node.id}
                    style={{ left: `${node.x}px`, top: `${node.y}px` }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-300 ${
                      isReached
                        ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                        : isCurrent
                        ? 'bg-blue-600 text-white ring-4 ring-blue-500/40 animate-pulse'
                        : 'bg-slate-800 text-slate-300 border border-slate-700'
                    }`}
                  >
                    {node.label}
                  </div>
                );
              })}

              {/* Cursor representation */}
              <div 
                className="absolute transition-all duration-700 ease-out pointer-events-none flex items-center gap-1.5"
                style={{
                  left: activeNode === 1 ? '55px' : activeNode === 2 ? '120px' : activeNode === 3 ? '210px' : activeNode === 4 ? '280px' : '200px',
                  top: activeNode === 1 ? '48px' : activeNode === 2 ? '90px' : activeNode === 3 ? '60px' : activeNode === 4 ? '120px' : '180px',
                }}
              >
                <div className="w-3.5 h-3.5 rounded-full bg-cyan-400 ring-4 ring-cyan-400/30 animate-ping"></div>
                <div className="bg-slate-900/90 text-cyan-300 text-[10px] px-1.5 py-0.5 rounded border border-cyan-500/30 font-mono">
                  t = +{(timerMs % 1000)}ms
                </div>
              </div>

              {/* Canvas resolution watermark */}
              <div className="absolute bottom-2 right-3 text-[10px] font-mono text-slate-500 bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800">
                HTML5 Canvas 60 FPS • Delta: 16.6ms
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tremor' && (
          <div className="space-y-3">
            <div className="bg-blue-50/80 border border-blue-200/80 rounded-lg p-3 text-xs text-blue-900 flex items-start gap-2.5">
              <Activity className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Análisis Espectral de Temblor Motor:</span>
                <p className="text-slate-600 mt-0.5">
                  Monitoreo de micro-oscilaciones cinemáticas (4 - 12 Hz) durante el desplazamiento del cursor para detección temprana de signos extrapiramidales.
                </p>
              </div>
            </div>

            {/* Simulated Waveform Canvas */}
            <div className="h-36 bg-slate-900 rounded-xl p-3 border border-slate-800 flex flex-col justify-between">
              <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono">
                <span>SEÑAL CINEMÁTICA EN TIEMPO REAL (dx/dt & dy/dt)</span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Banda Fisiológica Normal
                </span>
              </div>

              {/* Waveform graphic */}
              <svg className="w-full h-16" viewBox="0 0 400 60" preserveAspectRatio="none">
                <path
                  d="M 0,30 Q 20,25 40,30 T 80,32 T 120,28 T 160,33 T 200,27 T 240,34 T 280,26 T 320,31 T 360,29 L 400,30"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2"
                />
                <path
                  d="M 0,30 Q 15,22 30,30 T 60,35 T 90,24 T 120,36 T 150,22 T 180,37 T 210,23 T 240,36 T 270,22 T 300,37 T 330,23 T 360,36 L 400,30"
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                  opacity="0.6"
                />
              </svg>

              <div className="grid grid-cols-3 text-center text-[11px] font-mono border-t border-slate-800 pt-1.5">
                <div>
                  <span className="text-slate-500 block text-[9px]">FRECUENCIA PICO</span>
                  <span className="text-white font-bold">1.8 Hz</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9px]">ÍNDICE DE JERK</span>
                  <span className="text-emerald-400 font-bold">0.14 m/s³</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9px]">DESV. ESTÁNDAR</span>
                  <span className="text-cyan-400 font-bold">± 1.1 px</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'report' && (
          <div className="space-y-3">
            <div className="bg-emerald-50 border border-emerald-200/80 rounded-lg p-2.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                <span className="font-semibold text-emerald-900">Reporte Clínico Estructurado (.xlsx)</span>
              </div>
              <span className="text-[11px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-mono font-medium">
                Generado al instante
              </span>
            </div>

            {/* Table Mockup */}
            <div className="border border-slate-200 rounded-lg overflow-hidden text-[11px]">
              <div className="bg-slate-100 font-semibold text-slate-700 grid grid-cols-4 p-2 border-b border-slate-200">
                <span>Prueba / Parámetro</span>
                <span>Valor Medido</span>
                <span>Baremo Poblacional</span>
                <span>Diagnóstico Previo</span>
              </div>
              <div className="divide-y divide-slate-100 bg-white">
                <div className="grid grid-cols-4 p-2 text-slate-700 font-mono">
                  <span className="font-sans font-medium text-slate-900">TMT Parte A</span>
                  <span>24.812 s</span>
                  <span className="text-slate-600">Pc 75 (Media: 29s)</span>
                  <span className="text-emerald-600 font-sans font-semibold">Adecuado</span>
                </div>
                <div className="grid grid-cols-4 p-2 text-slate-700 font-mono bg-slate-50/50">
                  <span className="font-sans font-medium text-slate-900">TMT Parte B</span>
                  <span>58.120 s</span>
                  <span className="text-slate-600">Pc 65 (Media: 72s)</span>
                  <span className="text-emerald-600 font-sans font-semibold">Adecuado</span>
                </div>
                <div className="grid grid-cols-4 p-2 text-slate-700 font-mono">
                  <span className="font-sans font-medium text-slate-900">Cinemática Motor</span>
                  <span>1.8 Hz Jitter</span>
                  <span className="text-slate-600">&lt; 3.5 Hz Normal</span>
                  <span className="text-emerald-600 font-sans font-semibold">Sin temblor</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                onClick={onOpenExcelPreview}
                className="text-xs font-semibold text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Ver Hoja de Cálculo Completa</span>
              </button>
            </div>
          </div>
        )}

        {/* Footer Actions inside Mockup */}
        <div className="pt-3 mt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-slate-600">Validado en +120,000 aplicaciones clínicas</span>
          </div>

          <button
            onClick={onOpenDemo}
            className="text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
          >
            <span>Interactuar con el Canvas</span>
            <span aria-hidden="true">&rarr;</span>
          </button>
        </div>
      </div>
    </div>
  );
};
