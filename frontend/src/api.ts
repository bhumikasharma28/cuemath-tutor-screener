import { TutorProfile, EvaluationReport } from './types';

const BASE = '/api';

export async function startSession(tutorProfile: TutorProfile): Promise<{
  sessionId: string;
  message: string;
}> {
  const res = await fetch(`${BASE}/sessions/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tutorProfile }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Network error' }));
    throw new Error(err.error || 'Failed to start session');
  }
  return res.json();
}

export async function sendMessage(
  sessionId: string,
  message: string
): Promise<{
  message: string;
  isComplete: boolean;
  evaluation?: EvaluationReport;
}> {
  const res = await fetch(`${BASE}/sessions/${sessionId}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Network error' }));
    throw new Error(err.error || 'Failed to send message');
  }
  return res.json();
}

export async function getSessions(): Promise<
  Array<{
    id: string;
    tutorName: string;
    email: string;
    isComplete: boolean;
    recommendation?: 'hire' | 'hold' | 'reject';
    overallScore?: number;
    createdAt: string;
    completedAt?: string;
  }>
> {
  const res = await fetch(`${BASE}/sessions`);
  if (!res.ok) throw new Error('Failed to fetch sessions');
  return res.json();
}

export async function getSession(sessionId: string): Promise<{
  id: string;
  tutorProfile: { name: string; email: string };
  isComplete: boolean;
  evaluation?: EvaluationReport;
  createdAt: string;
  completedAt?: string;
}> {
  const res = await fetch(`${BASE}/sessions/${sessionId}`);
  if (!res.ok) throw new Error('Session not found');
  return res.json();
}
