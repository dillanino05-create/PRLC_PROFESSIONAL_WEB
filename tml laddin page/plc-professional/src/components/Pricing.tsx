import React, { useState } from 'react';
import { Check, Sparkles, Shield, HelpCircle, ArrowRight, Zap } from 'lucide-react';
import { Plan } from '../types';

interface PricingProps {
  onSelectPlan: (planId: 'basic' | 'pro' | 'enterprise') => void;
}

export const Pricing: React.FC<PricingProps> = ({ onSelectPlan }) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');

  const plans: Plan[] = [
    {
      id: 'basic',
      name: 'Plan Básico',
      tagline: 'Ideal para neuropsicólogos en práctica privada y consultorios independientes.',
      monthlyPrice: 39,
      annualPrice: 31,
      buttonText: 'Seleccionar Plan Básico',
      features: [
        'Hasta 30 evaluaciones al mes',
        'Cronometría Canvas de alta precisión (<1ms)',
        'Descarga automática de reportes en Excel (.xlsx)',
        'Protocolos estandarizados (TMT A & B)',
        'Aislamiento de seguridad RLS por profesional',
        '1 usuario clínico titular',
        'Soporte por correo electrónico (24-48h)',
      ],
      limitations: [
        'Sin módulo avanzado de biomarcadores de temblor',
        'Sin reportes en PDF ejecutivo con membrete',
      ]
    },
    {
      id: 'pro',
      name: 'Plan Pro',
      tagline: 'Para clínicas y especialistas que requieren telemetría de temblor y volumen ilimitado.',
      monthlyPrice: 79,
      annualPrice: 63,
      popular: true,
      badge: 'MÁS POPULAR • RECOMENDADO',
      buttonText: 'Seleccionar Plan Pro (14 Días Gratis)',
      features: [
        'Evaluaciones de pacientes ILIMITADAS',
        'Cronometría Canvas sub-milisegundo (<1ms)',
        'Módulo completo de Biomarcadores Motores y Temblor',
        'Análisis de velocidad angular, aceleración y Jerk',
        'Descarga automática en Excel (.xlsx) y PDF clínico',
        'Baremos automáticos (Percentiles y Puntuaciones Z)',
        'Multi-dispositivo (Tabletas táctiles, iPads y Laptops)',
        'Hasta 3 usuarios clínicos por suscripción',
        'Soporte prioritario con especialistas (< 2 horas)',
      ]
    },
    {
      id: 'enterprise',
      name: 'Plan Institucional',
      tagline: 'Para hospitales, universidades, centros de investigación y clínicas multi-sede.',
      monthlyPrice: 199,
      annualPrice: 159,
      buttonText: 'Seleccionar Plan Institucional',
      features: [
        'Evaluaciones y pacientes ILIMITADOS',
        'Usuarios y evaluadores clínicos ilimitados con RBAC',
        'Exportación de telemetría de datos crudos (SPSS, R, Python)',
        'Seguridad RLS institucional por departamentos/sedes',
        'Acuerdo de confidencialidad BAA (HIPAA / RGPD)',
        'API de integración con sistemas HIS / EHR hospitalarios',
        'Baremos personalizados y normativas institucionales',
        'SLA garantizado del 99.9% de disponibilidad',
        'Account Manager y capacitación clínica personalizada',
      ]
    }
  ];

  return (
    <section id="pricing" className="py-20 lg:py-28 bg-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200">
            <Zap className="w-3.5 h-3.5" />
            <span>Precios Transparentes para Profesionales de la Salud</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight font-['Plus_Jakarta_Sans',sans-serif]">
            Planes flexibles adaptados a tu práctica clínica
          </h2>
          <p className="text-lg text-slate-600">
            Comienza con 14 días de prueba gratuita completa. Sin compromiso de permanencia.
          </p>

          {/* Billing Cycle Toggle (DocuSign/Slack style) */}
          <div className="pt-4 flex items-center justify-center">
            <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200 shadow-inner">
              <button
                id="toggle-monthly"
                onClick={() => setBillingCycle('monthly')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  billingCycle === 'monthly'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Facturación Mensual
              </button>

              <button
                id="toggle-annual"
                onClick={() => setBillingCycle('annual')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  billingCycle === 'annual'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Facturación Anual</span>
                <span className={`text-[11px] px-1.5 py-0.2 rounded font-bold ${
                  billingCycle === 'annual' ? 'bg-blue-800 text-cyan-200' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  Ahorra 20%
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* 3 Columns Pricing Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          {plans.map((plan) => {
            const price = billingCycle === 'annual' ? plan.annualPrice : plan.monthlyPrice;

            return (
              <div
                key={plan.id}
                className={`rounded-2xl p-8 transition-all flex flex-col justify-between relative ${
                  plan.popular
                    ? 'bg-gradient-to-b from-blue-50/70 via-white to-slate-50 border-2 border-blue-600 shadow-xl shadow-blue-500/10 lg:-translate-y-2'
                    : 'bg-white border border-slate-200 shadow-md hover:shadow-lg'
                }`}
              >
                {/* Popular Pill */}
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[11px] font-extrabold uppercase tracking-wider py-1 px-3.5 rounded-full shadow-sm flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{plan.badge}</span>
                  </div>
                )}

                <div>
                  {/* Plan Name & Tagline */}
                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
                      {plan.name}
                    </h3>
                    <p className="text-xs text-slate-500 min-h-[36px] leading-relaxed">
                      {plan.tagline}
                    </p>
                  </div>

                  {/* Price */}
                  <div className="mt-6 mb-6 pt-6 border-t border-slate-100">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-extrabold text-slate-900 font-mono tracking-tight">
                        ${price}
                      </span>
                      <span className="text-xs font-semibold text-slate-500 uppercase">
                        USD / mes
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 block mt-1 font-mono">
                      {billingCycle === 'annual' ? `Facturado anualmente ($${price * 12}/año)` : 'Facturado mes a mes'}
                    </span>
                  </div>

                  {/* CTA Button */}
                  <button
                    id={`btn-select-plan-${plan.id}`}
                    onClick={() => onSelectPlan(plan.id)}
                    className={`w-full py-3 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      plan.popular
                        ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/25 hover:shadow-blue-600/35'
                        : 'bg-slate-900 hover:bg-slate-800 text-white'
                    }`}
                  >
                    <span>{plan.buttonText}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  {/* Feature Checklist */}
                  <div className="mt-8 space-y-3 text-xs">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Incluye:
                    </span>
                    {plan.features.map((feat, fIdx) => (
                      <div key={fIdx} className="flex items-start gap-2.5 text-slate-700">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0 stroke-[2.5] mt-0.5" />
                        <span className="leading-tight">{feat}</span>
                      </div>
                    ))}

                    {plan.limitations && plan.limitations.map((lim, lIdx) => (
                      <div key={lIdx} className="flex items-start gap-2.5 text-slate-400">
                        <span className="w-4 h-4 text-slate-300 shrink-0 text-center font-mono">✕</span>
                        <span className="leading-tight">{lim}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
                  <Shield className="w-3.5 h-3.5 text-blue-600" />
                  <span>Garantía de reembolso de 30 días</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Enterprise Inquiries Box */}
        <div className="mt-12 bg-slate-50 rounded-2xl p-6 border border-slate-200 text-center flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-left space-y-1">
            <span className="text-sm font-bold text-slate-900 block">
              ¿Necesitas una implementación especial para una Universidad o Red Hospitalaria?
            </span>
            <p className="text-xs text-slate-600">
              Ofrecemos licenciamiento masivo para facultades de psicología, entornos de investigación clínica y servidores dedicados.
            </p>
          </div>
          <button
            onClick={() => onSelectPlan('enterprise')}
            className="whitespace-nowrap px-5 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold border border-slate-300 transition cursor-pointer"
          >
            Hablar con Asesor Clínico
          </button>
        </div>

      </div>
    </section>
  );
};
