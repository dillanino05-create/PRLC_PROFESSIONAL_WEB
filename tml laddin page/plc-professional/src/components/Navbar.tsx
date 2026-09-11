import React, { useState, useEffect } from 'react';
import { Activity, ShieldCheck, Menu, X, ChevronRight, Lock, Sparkles, CheckCircle2 } from 'lucide-react';

interface NavbarProps {
  onOpenAuth: (mode: 'login' | 'register', planId?: string) => void;
  onOpenDemo: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenAuth, onOpenDemo }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Beneficios', href: '#features' },
    { name: 'Cómo Funciona', href: '#how-it-works' },
    { name: 'Biomarcadores', href: '#biomarkers' },
    { name: 'Precios', href: '#pricing' },
    { name: 'Seguridad RLS', href: '#security' },
    { name: 'Preguntas', href: '#faq' },
  ];

  return (
    <header
      id="main-navbar"
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
        isScrolled
          ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-200/90 py-3'
          : 'bg-white/80 backdrop-blur-sm border-b border-slate-100 py-4'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Brand Logo */}
          <a
            id="brand-logo-link"
            href="#"
            className="flex items-center gap-3 group focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg p-1"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 via-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:shadow-blue-500/30 transition-shadow">
              <Activity className="w-5 h-5 text-white stroke-[2.5]" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-bold tracking-tight text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
                  Meca<span className="text-blue-600">Psi</span>
                </span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/60">
                  HealthTech DSS
                </span>
              </div>
              <span className="text-[11px] font-medium text-slate-500 tracking-wider uppercase">
                Evaluación Neuropsicológica
              </span>
            </div>
          </a>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.name}
                id={`nav-link-${link.name.toLowerCase().replace(/\s+/g, '-')}`}
                href={link.href}
                className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors py-1"
              >
                {link.name}
              </a>
            ))}
          </nav>

          {/* Desktop Right CTAs */}
          <div className="hidden sm:flex items-center gap-3">
            <button
              id="nav-btn-try-demo"
              onClick={onOpenDemo}
              className="text-xs font-semibold text-slate-700 hover:text-blue-700 px-3 py-2 rounded-lg hover:bg-slate-100 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>Demo en Vivo</span>
            </button>

            <button
              id="nav-btn-login"
              onClick={() => onOpenAuth('login')}
              className="text-sm font-semibold text-slate-700 hover:text-slate-900 px-4 py-2 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
            >
              Iniciar Sesión
            </button>

            <button
              id="nav-btn-register"
              onClick={() => onOpenAuth('register')}
              className="text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 px-4 py-2 rounded-lg shadow-sm shadow-blue-600/25 hover:shadow-blue-600/35 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>Probar Gratis</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex sm:hidden items-center gap-2">
            <button
              id="mobile-register-quick"
              onClick={() => onOpenAuth('register')}
              className="text-xs font-bold text-white bg-blue-600 px-2.5 py-1.5 rounded-md"
            >
              Probar
            </button>
            <button
              id="mobile-menu-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Abrir menú"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div id="mobile-nav-drawer" className="lg:hidden bg-white border-b border-slate-200 shadow-xl px-4 pt-3 pb-6 space-y-3">
          <div className="flex flex-col space-y-1">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2.5 rounded-lg text-base font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
              >
                {link.name}
              </a>
            ))}
          </div>

          <div className="pt-3 border-t border-slate-200 space-y-2.5">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenDemo();
              }}
              className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Probar Demo de Evaluación
            </button>

            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenAuth('login');
              }}
              className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-100 border border-slate-300"
            >
              Iniciar Sesión
            </button>

            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenAuth('register');
              }}
              className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20"
            >
              Registrarse / Probar Gratis (14 Días)
            </button>

            <div className="flex items-center justify-center gap-2 pt-2 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Cumplimiento HIPAA y Cifrado Clínico</span>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
