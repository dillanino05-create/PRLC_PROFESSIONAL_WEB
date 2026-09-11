import React from 'react';
import { ArrowRight, Play, Shield, Check, Sparkles, Clock, FileSpreadsheet, Lock } from 'lucide-react';
import { DashboardMockup } from './DashboardMockup';

interface HeroProps {
  onOpenAuth: (mode: 'login' | 'register') => void;
  onOpenDemo: () => void;
  onOpenExcelPreview: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onOpenAuth, onOpenDemo, onOpenExcelPreview }) => {
  return (
    <section id="hero" className="relative pt-28 pb-16 lg:pt-36 lg:pb-24 overflow-hidden bg-gradient-to-b from-white via-slate-50/70 to-white">
      {/* Subtle background radial glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-br from-blue-100/40 via-cyan-100/30 to-transparent blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-40 right-0 w-80 h-80 bg-blue-200/20 blur-3xl rounded-full pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* Left Column: Value Proposition & CTAs */}
          <div className="lg:col-span-6 space-y-6 text-center lg:text-left">
            {/* Top pill badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200/70 text-blue-700 text-xs font-semibold shadow-xs">
              <span className="flex h-2 w-2 rounded-full bg-blue-600 animate-pulse"></span>
              <span>SaaS HealthTech para Neuropsicología y Neurología</span>
              <span className="text-blue-400">|</span>
              <span className="text-slate-600 font-medium">Baterías Digitales</span>
            </div>

            {/* Powerful Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-5xl xl:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.1] font-['Plus_Jakarta_Sans',sans-serif]">
              Digitaliza tus evaluaciones{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-600">
                neuropsicológicas
              </span>{' '}
              en segundos
            </h1>

            {/* Subtitle explicitly replacing paper & pencil */}
            <p className="text-lg sm:text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto lg:mx-0 font-normal">
              Reemplaza definitivamente las pruebas en papel y lápiz y el cronómetro manual. <strong>MecaPsi</strong> digitaliza el <strong>Test de Atención d2 de Brickenkamp</strong> (14 líneas × 47 caracteres × 20s), captura <span className="font-semibold text-slate-900">biomarcadores de temblor motor a 60 fps</span> (umbral 85.0 px/s²) y clasifica el perfil cognitivo con una <span className="font-semibold text-slate-900">red neuronal MLP Keras</span> con reporte en Excel listo para la historia médica.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
              <button
                id="hero-cta-register"
                onClick={() => onOpenAuth('register')}
                className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-base shadow-lg shadow-blue-600/25 hover:shadow-blue-600/35 transition-all flex items-center justify-center gap-2.5 cursor-pointer group"
              >
                <span>Probar Gratis (14 Días)</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                id="hero-cta-demo"
                onClick={onOpenDemo}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white hover:bg-slate-100/80 text-slate-800 font-bold text-base border border-slate-300/80 shadow-xs hover:border-slate-400 transition-all flex items-center justify-center gap-2.5 cursor-pointer"
              >
                <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Play className="w-3 h-3 fill-blue-600" />
                </div>
                <span>Ver Demostración Interactiva</span>
              </button>
            </div>

            {/* Trust bullet points below CTA */}
            <div className="pt-3 border-t border-slate-200/80 flex flex-wrap items-center justify-center lg:justify-start gap-y-2 gap-x-6 text-xs text-slate-500">
              <div className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600 stroke-[2.5]" />
                <span className="font-medium text-slate-700">Sin tarjeta de crédito requerida</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-blue-600 stroke-[2.5]" />
                <span className="font-medium text-slate-700">Conformidad HIPAA y RGPD Salud</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-cyan-600 stroke-[2.5]" />
                <span className="font-medium text-slate-700">Configuración en menos de 2 minutos</span>
              </div>
            </div>

            {/* Metric pill indicators */}
            <div className="grid grid-cols-3 gap-3 pt-2 max-w-lg mx-auto lg:mx-0">
              <div className="bg-white/80 backdrop-blur-xs border border-slate-200/90 rounded-xl p-3 text-center shadow-xs">
                <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono tracking-tight">&lt; 1 ms</div>
                <div className="text-[11px] font-medium text-slate-500 mt-0.5">Precisión temporal</div>
              </div>
              <div className="bg-white/80 backdrop-blur-xs border border-slate-200/90 rounded-xl p-3 text-center shadow-xs">
                <div className="text-xl sm:text-2xl font-black text-blue-600 font-mono tracking-tight">100%</div>
                <div className="text-[11px] font-medium text-slate-500 mt-0.5">Reportes en Excel</div>
              </div>
              <div className="bg-white/80 backdrop-blur-xs border border-slate-200/90 rounded-xl p-3 text-center shadow-xs">
                <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono tracking-tight">RLS</div>
                <div className="text-[11px] font-medium text-slate-500 mt-0.5">Seguridad por paciente</div>
              </div>
            </div>
          </div>

          {/* Right Column: Dashboard Mockup */}
          <div className="lg:col-span-6">
            <DashboardMockup 
              onOpenExcelPreview={onOpenExcelPreview}
              onOpenDemo={onOpenDemo}
            />
          </div>

        </div>
      </div>
    </section>
  );
};
