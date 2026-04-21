export interface TutorProfile {
  name: string;
  email: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface EvaluationScores {
  clarity: number;
  warmth: number;
  simplicity: number;
  patience: number;
  fluency: number;
  overall: number;
}

export interface FillerWordStats {
  total: number;
  counts: Record<string, number>;
  topWord: string | null;
  percentage: number; // fillers per 100 words spoken
}

export type ConfidenceLevel = 'confident' | 'neutral' | 'nervous';

export interface ConfidenceSummary {
  overall: ConfidenceLevel;
  avgScore: number;          // -6 to +5 scale
  avgResponseDelay: number;  // seconds before first speech
  avgFillerRate: number;     // filler % per answer
  avgAnswerLength: number;   // words per answer
}

export interface EvaluationReport {
  scores: EvaluationScores;
  recommendation: 'hire' | 'hold' | 'reject';
  strengths: string[];
  improvements: string[];
  quotes: string[];
  detailedFeedback: {
    teaching: string;
    communication: string;
  };
  summary: string;
  fillerWords?: FillerWordStats;
  confidence?: ConfidenceSummary;
}

export type AppScreen = 'landing' | 'screening' | 'results';
