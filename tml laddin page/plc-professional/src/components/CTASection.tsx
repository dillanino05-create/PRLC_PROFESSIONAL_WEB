import React from 'react';
import { ArrowRight, ShieldCheck, Check, Sparkles } from 'lucide-react';

interface CTASectionProps {
  onOpenAuth: (mode: 'login' | 'register') => void;
  onOpenDemo: () => void;
}

export const CTASection: React.FC<CTASectionProps> = ({ onOpenAuth, onOpenDemo }) => {
  return (
    <section className="py-20 bg-gradient-to-br from-blue-900 via-slate-900 to-slate-950 text-white relative overflow-hidden">
      {/* Background accents */}
      <div className="absolute top-0 right-1/3 w-96 h-96 bg-blue-500/15 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 left-1/3 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8 relative z-10">
        
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>Moderniza tu Consulta Neuropsicológica Hoy Mismo</span>
        </div>

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight font-['Plus_Jakarta_Sans',sans-serif] max-w-3xl mx-auto leading-tight">
          Deja atrás el papel y lleva tus evaluaciones a la vanguardia clínica
        </h2>

        <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
          Comienza a evaluar con cronometría de milisegundos, telemetría de temblor motor y generación inmediata de reportes en Excel.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <button
            onClick={() => onOpenAuth('register')}
            className="w-full sm:w-auto px-8 py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-base shadow-xl shadow-blue-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer group"
          >
            <span>Crear Cuenta Gratuita (14 Días)</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>

          <button
            onClick={onOpenDemo}
            className="w-full sm:w-auto px-7 py-4 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-white font-semibold text-base border border-slate-700 transition cursor-pointer"
          >
            Probar Simulador Interactivo
          </button>
        </div>

        {/* Guarantees */}
        <div className="pt-6 border-t border-slate-800/80 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 stroke-[2.5]" />
            <span>Sin tarjeta de crédito requerida</span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-400 stroke-[2.5]" />
            <span>Cumplimiento estricto HIPAA y RGPD</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-cyan-400 stroke-[2.5]" />
            <span>Migración y soporte clínico guiado</span>
          </div>
        </div>

      </div>
    </section>
  );
};
