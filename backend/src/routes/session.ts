import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ScreenerSession, StartSessionRequest, SendMessageRequest } from '../types';
import {
  getInitialMessage,
  continueConversation,
  parseEvaluation,
  stripEvaluationBlock,
} from '../services/openrouter';

const router = Router();
const sessions = new Map<string, ScreenerSession>();

router.post('/start', async (req: Request, res: Response) => {
  try {
    const { tutorProfile } = req.body as StartSessionRequest;

    if (!tutorProfile?.name || !tutorProfile?.email) {
      return res.status(400).json({ error: 'Missing required profile fields' });
    }

    const sessionId = uuidv4();
    const firstUserMessage = `Hi! I'm ${tutorProfile.name} and I'm ready to start the Cuemath tutor screening.`;
    const initialMessage = await getInitialMessage(tutorProfile);

    const session: ScreenerSession = {
      id: sessionId,
      tutorProfile,
      messages: [
        { role: 'user', content: firstUserMessage, timestamp: new Date().toISOString() },
        { role: 'assistant', content: initialMessage, timestamp: new Date().toISOString() },
      ],
      isComplete: false,
      createdAt: new Date().toISOString(),
    };

    sessions.set(sessionId, session);

    return res.json({
      sessionId,
      message: initialMessage,
    });
  } catch (error) {
    console.error('Error starting session:', error);
    return res.status(500).json({ error: 'Failed to start screening session' });
  }
});

router.post('/:sessionId/message', async (req: Request, res: Response) => {
  try {
    const sessionId = req.params['sessionId'] as string;
    const { message } = req.body as SendMessageRequest;

    if (!message?.trim()) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (session.isComplete) {
      return res.status(400).json({ error: 'Session is already complete' });
    }

    session.messages.push({
      role: 'user',
      content: message.trim(),
      timestamp: new Date().toISOString(),
    });

    const rawResponse = await continueConversation(session.tutorProfile, session.messages);
    const evaluation = parseEvaluation(rawResponse);
    const displayMessage = evaluation ? stripEvaluationBlock(rawResponse) : rawResponse;

    session.messages.push({
      role: 'assistant',
      content: rawResponse,
      timestamp: new Date().toISOString(),
    });

    if (evaluation) {
      session.isComplete = true;
      session.evaluation = evaluation;
      session.completedAt = new Date().toISOString();
    }

    return res.json({
      message: displayMessage,
      isComplete: session.isComplete,
      evaluation: session.evaluation,
    });
  } catch (error) {
    console.error('Error processing message:', error);
    return res.status(500).json({ error: 'Failed to process message' });
  }
});

router.get('/:sessionId', (req: Request, res: Response) => {
  const session = sessions.get(req.params['sessionId'] as string);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  return res.json(session);
});

router.get('/', (_req: Request, res: Response) => {
  const list = Array.from(sessions.values()).map((s) => ({
    id: s.id,
    tutorName: s.tutorProfile.name,
    email: s.tutorProfile.email,
    isComplete: s.isComplete,
    recommendation: s.evaluation?.recommendation,
    overallScore: s.evaluation?.scores.overall,
    createdAt: s.createdAt,
    completedAt: s.completedAt,
  }));
  return res.json(list);
});

export default router;
