import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { SocialProof } from './components/SocialProof';
import { Features } from './components/Features';
import { InteractiveTestDemo } from './components/InteractiveTestDemo';
import { HowItWorks } from './components/HowItWorks';
import { Pricing } from './components/Pricing';
import { Testimonials } from './components/Testimonials';
import { FAQ } from './components/FAQ';
import { CTASection } from './components/CTASection';
import { Footer } from './components/Footer';
import { AuthModal } from './components/AuthModal';
import { ExcelReportModal } from './components/ExcelReportModal';
import { LegalModal } from './components/LegalModal';
import { CheckCircle2, X } from 'lucide-react';

export default function App() {
  const [authModalState, setAuthModalState] = useState<{
    isOpen: boolean;
    mode: 'login' | 'register';
    planId?: string;
  }>({
    isOpen: false,
    mode: 'register',
    planId: 'pro',
  });

  const [excelModalOpen, setExcelModalOpen] = useState(false);
  const [legalModalType, setLegalModalType] = useState<'terms' | 'privacy' | 'hipaa' | null>(null);

  // Success Notification Toast for demo interaction
  const [toastNotification, setToastNotification] = useState<{
    show: boolean;
    title: string;
    message: string;
  }>({
    show: false,
    title: '',
    message: '',
  });

  const handleOpenAuth = (mode: 'login' | 'register', planId?: string) => {
    setAuthModalState({
      isOpen: true,
      mode,
      planId: planId || 'pro',
    });
  };

  const handleCloseAuth = () => {
    setAuthModalState((prev) => ({ ...prev, isOpen: false }));
  };

  const handleAuthSuccess = (email: string, role: string) => {
    setToastNotification({
      show: true,
      title: '¡Acceso Clínico Concedido!',
      message: `Bienvenido/a a PLC Professional (${email}). Protocolo y seguridad RLS activados para ${role}.`,
    });
    setTimeout(() => {
      setToastNotification((prev) => ({ ...prev, show: false }));
    }, 6000);
  };

  const handleScrollToDemo = () => {
    const el = document.getElementById('demo-interactive');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Sticky Top Navbar */}
      <Navbar
        onOpenAuth={(mode, planId) => handleOpenAuth(mode, planId)}
        onOpenDemo={handleScrollToDemo}
      />

      {/* Main Content Sections */}
      <main className="flex-1">
        {/* 1. Hero Section with Headline, Subtitle, 2 CTAs and Dashboard Mockup */}
        <Hero
          onOpenAuth={(mode) => handleOpenAuth(mode)}
          onOpenDemo={handleScrollToDemo}
          onOpenExcelPreview={() => setExcelModalOpen(true)}
        />

        {/* 2. Social Proof with Institutional Badges & Compliance Seals */}
        <SocialProof />

        {/* 3. Features Bento Box (Cronometría Canvas, Biomarcadores Temblor, Seguridad RLS) */}
        <Features />

        {/* 4. Interactive Test Demo Canvas (Live simulator) */}
        <InteractiveTestDemo
          onOpenAuth={(mode) => handleOpenAuth(mode)}
          onOpenExcelPreview={() => setExcelModalOpen(true)}
        />

        {/* 5. How It Works (3 Steps: Registra -> Ejecuta -> Descarga Excel) */}
        <HowItWorks
          onOpenAuth={(mode) => handleOpenAuth(mode)}
          onOpenExcelPreview={() => setExcelModalOpen(true)}
        />

        {/* 6. Pricing Tabulator (Plan Básico, Plan Pro, Plan Institucional) */}
        <Pricing
          onSelectPlan={(planId) => handleOpenAuth('register', planId)}
        />

        {/* 7. Clinical Peer Testimonials */}
        <Testimonials />

        {/* 8. Frequently Asked Questions */}
        <FAQ />

        {/* 9. High-converting CTA Banner */}
        <CTASection
          onOpenAuth={(mode) => handleOpenAuth(mode)}
          onOpenDemo={handleScrollToDemo}
        />
      </main>

      {/* 10. Deep Medical SaaS Footer with Legal, Terms, Privacy and Disclaimer */}
      <Footer
        onOpenLegalModal={(type) => setLegalModalType(type)}
      />

      {/* Modals & Dialogs */}
      <AuthModal
        isOpen={authModalState.isOpen}
        mode={authModalState.mode}
        initialPlanId={authModalState.planId}
        onClose={handleCloseAuth}
        onSuccess={handleAuthSuccess}
      />

      <ExcelReportModal
        isOpen={excelModalOpen}
        onClose={() => setExcelModalOpen(false)}
      />

      <LegalModal
        isOpen={Boolean(legalModalType)}
        type={legalModalType}
        onClose={() => setLegalModalType(null)}
      />

      {/* Floating Success Toast */}
      {toastNotification.show && (
        <div 
          id="toast-notification"
          className="fixed bottom-6 right-6 z-50 max-w-md bg-slate-900 text-white rounded-2xl p-4 shadow-2xl border border-blue-500/40 flex items-start gap-3 animate-in slide-in-from-bottom-5 duration-300"
        >
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h5 className="font-bold text-sm text-white">{toastNotification.title}</h5>
            <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">{toastNotification.message}</p>
          </div>
          <button
            onClick={() => setToastNotification((prev) => ({ ...prev, show: false }))}
            className="text-slate-400 hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
