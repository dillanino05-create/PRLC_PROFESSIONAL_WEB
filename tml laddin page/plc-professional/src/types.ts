export interface Plan {
  id: 'basic' | 'pro' | 'enterprise';
  name: string;
  tagline: string;
  monthlyPrice: number;
  annualPrice: number;
  popular?: boolean;
  features: string[];
  limitations?: string[];
  badge?: string;
  buttonText: string;
}

export interface PatientTrialResult {
  patientId: string;
  patientName: string;
  age: number;
  educationYears: number;
  testName: string;
  reactionTimeMs: number;
  movementTimeMs: number;
  totalTimeMs: number;
  tremorFrequencyHz: number;
  tremorAmplitudePixels: number;
  smoothnessScore: number;
  percentileScore: number;
  clinicalInterpretation: 'Normal' | 'Leve sospecha motora' | 'Déficit psicomotor';
  timestamp: string;
}

export interface Testimonial {
  id: string;
  quote: string;
  author: string;
  role: string;
  institution: string;
  rating: number;
  avatar: string;
  verifiedDoctor: boolean;
}

export interface FAQItem {
  question: string;
  answer: string;
  category: 'clinical' | 'technical' | 'security' | 'billing';
}
