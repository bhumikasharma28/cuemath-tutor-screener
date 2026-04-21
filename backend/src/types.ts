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
}

export interface ScreenerSession {
  id: string;
  tutorProfile: TutorProfile;
  messages: ChatMessage[];
  isComplete: boolean;
  evaluation?: EvaluationReport;
  createdAt: string;
  completedAt?: string;
}

export interface StartSessionRequest {
  tutorProfile: TutorProfile;
}

export interface SendMessageRequest {
  message: string;
}
