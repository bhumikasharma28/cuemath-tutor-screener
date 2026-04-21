import { useState } from 'react';
import { AppScreen, TutorProfile, EvaluationReport } from './types';
import { startSession } from './api';
import LandingPage from './components/LandingPage';
import ScreeningChat from './components/ScreeningChat';
import ResultsPage from './components/ResultsPage';
import AdminDashboard from './components/AdminDashboard';

export default function App() {
  if (window.location.pathname === '/admin') return <AdminDashboard />;

  const [screen, setScreen] = useState<AppScreen>('landing');
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [initialMessage, setInitialMessage] = useState<string | null>(null);
  const [tutorProfile, setTutorProfile] = useState<TutorProfile | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationReport | null>(null);

  const handleProfileSubmit = async (profile: TutorProfile) => {
    setIsStarting(true);
    setStartError(null);
    try {
      const result = await startSession(profile);
      setSessionId(result.sessionId);
      setInitialMessage(result.message);
      setTutorProfile(profile);
      setScreen('screening');
    } catch (err) {
      setStartError(err instanceof Error ? err.message : 'Failed to start session. Is the backend running?');
    } finally {
      setIsStarting(false);
    }
  };

  const handleComplete = (report: EvaluationReport) => {
    setEvaluation(report);
    setScreen('results');
  };

  const handleRestart = () => {
    setScreen('landing');
    setSessionId(null);
    setInitialMessage(null);
    setTutorProfile(null);
    setEvaluation(null);
    setStartError(null);
  };

  if (screen === 'landing') {
    return <LandingPage onSubmit={handleProfileSubmit} isLoading={isStarting} error={startError} />;
  }

  if (screen === 'screening' && sessionId && initialMessage && tutorProfile) {
    return (
      <ScreeningChat
        sessionId={sessionId}
        initialMessage={initialMessage}
        tutorProfile={tutorProfile}
        onComplete={handleComplete}
      />
    );
  }

  if (screen === 'results' && evaluation && tutorProfile) {
    return (
      <ResultsPage
        evaluation={evaluation}
        tutorProfile={tutorProfile}
        onRestart={handleRestart}
      />
    );
  }

  return null;
}
