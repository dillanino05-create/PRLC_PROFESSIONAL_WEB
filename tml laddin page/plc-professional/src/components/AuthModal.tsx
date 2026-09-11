import React, { useState } from 'react';
import { X, ShieldCheck, Check, Lock, Sparkles, UserCheck, ArrowRight, Activity, Building2 } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  mode: 'login' | 'register';
  initialPlanId?: string;
  onClose: () => void;
  onSuccess: (userEmail: string, role: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  mode: initialMode,
  initialPlanId = 'pro',
  onClose,
  onSuccess,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [selectedPlan, setSelectedPlan] = useState<string>(initialPlanId);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [specialty, setSpecialty] = useState('Neuropsicología Clínica');
  const [institution, setInstitution] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      onSuccess(email || 'dr.valenzuela@clinicaneuro.org', specialty);
      onClose();
    }, 1200);
  };

  const handleQuickDemo = (demoType: 'neuro' | 'research') => {
    if (demoType === 'neuro') {
      setEmail('dra.valenzuela@hospitalclinico.es');
      setPassword('••••••••••••');
      setFullName('Dra. Carmen Valenzuela');
      setSpecialty('Neuropsicología Clínica');
      setInstitution('Hospital Clínico Universitario');
    } else {
      setEmail('dr.rios@institutoneuro.org');
      setPassword('••••••••••••');
      setFullName('Dr. Alejandro Ríos');
      setSpecialty('Investigación en Neurociencias');
      setInstitution('Instituto de Neurociencias Aplicadas');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header bar */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
              <Activity className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <span className="font-bold text-base block font-['Plus_Jakarta_Sans',sans-serif]">
                PLC Professional
              </span>
              <span className="text-[11px] text-blue-300 font-medium">
                Portal de Acceso Clínico
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch between Login and Register */}
        <div className="flex border-b border-slate-200 bg-slate-50">
          <button
            onClick={() => setMode('register')}
            className={`flex-1 py-3 text-xs sm:text-sm font-semibold transition cursor-pointer ${
              mode === 'register'
                ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Crear Cuenta (14 Días Gratis)
          </button>
          <button
            onClick={() => setMode('login')}
            className={`flex-1 py-3 text-xs sm:text-sm font-semibold transition cursor-pointer ${
              mode === 'login'
                ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Iniciar Sesión
          </button>
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {mode === 'register' && (
            <div className="space-y-3">
              {/* Plan selection banner */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs flex items-center justify-between">
                <div>
                  <span className="font-bold text-blue-900 block">Plan Seleccionado:</span>
                  <span className="text-blue-700 capitalize font-medium">
                    {selectedPlan === 'basic' ? 'Plan Básico ($39/mes)' : selectedPlan === 'enterprise' ? 'Plan Institucional ($199/mes)' : 'Plan Pro ($79/mes) - Recomendado'}
                  </span>
                </div>
                <div className="flex gap-1">
                  {(['basic', 'pro', 'enterprise'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setSelectedPlan(p)}
                      className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition cursor-pointer ${
                        selectedPlan === p
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-slate-600 border border-slate-200'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nombre Completo del Especialista
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ej: Dra. Carmen Valenzuela"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Especialidad Principal
                  </label>
                  <select
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="Neuropsicología Clínica">Neuropsicología Clínica</option>
                    <option value="Neurología General">Neurología General</option>
                    <option value="Psicología Cognitiva">Psicología Cognitiva</option>
                    <option value="Psiquiatría">Psiquiatría</option>
                    <option value="Investigación / Docencia">Investigación / Docencia</option>
                    <option value="Terapia Ocupacional">Terapia Ocupacional</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Clínica / Institución
                  </label>
                  <input
                    type="text"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    placeholder="Ej: Hospital Clínico"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Correo Electrónico Profesional
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="profesional@clinica.org"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Contraseña
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {mode === 'register' && (
            <div className="flex items-start gap-2 pt-1 text-xs text-slate-600">
              <input
                type="checkbox"
                id="terms-check"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="terms-check" className="text-[11px] leading-tight text-slate-500">
                Acepto los <span className="text-blue-600 font-semibold">Términos de Servicio</span> y la <span className="text-blue-600 font-semibold">Política de Protección de Datos Médicos (HIPAA/RGPD)</span>.
              </label>
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={submitted || (mode === 'register' && !acceptedTerms)}
            className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {submitted ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <span>Configurando Entorno Seguro...</span>
              </>
            ) : mode === 'register' ? (
              <>
                <span>Iniciar Prueba Gratuita (14 Días)</span>
                <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              <>
                <span>Acceder a la Plataforma</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {/* Quick 1-Click Demo Credential Buttons (Great UX) */}
          <div className="pt-2 border-t border-slate-100">
            <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 text-center">
              Acceso Rápido de Demostración:
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickDemo('neuro')}
                className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left text-xs transition cursor-pointer"
              >
                <div className="font-bold text-slate-800">Dra. C. Valenzuela</div>
                <div className="text-[10px] text-slate-500">Neuropsicóloga Clínica</div>
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemo('research')}
                className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left text-xs transition cursor-pointer"
              >
                <div className="font-bold text-slate-800">Dr. A. Ríos</div>
                <div className="text-[10px] text-slate-500">Investigador Laboratorio</div>
              </button>
            </div>
          </div>

          <div className="pt-1 flex items-center justify-center gap-1.5 text-[11px] text-slate-400 text-center">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Cifrado TLS 1.3 de grado bancario • RLS Habilitado</span>
          </div>
        </form>
      </div>
    </div>
  );
};
