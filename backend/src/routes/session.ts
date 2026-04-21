import { Router, Request, Response, NextFunction } from 'express';
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

router.post('/start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tutorProfile } = req.body as StartSessionRequest;

    if (!tutorProfile?.name || !tutorProfile?.email) {
      return res.status(400).json({ error: 'Missing required profile fields' });
    }

    const sessionId = uuidv4();
    const firstUserMessage = `Hi! I'm ${tutorProfile.name} and I'm ready to start the Cuemath tutor screening.`;

    console.log(`[sessions/start] Starting session for ${tutorProfile.email}`);
    const initialMessage = await getInitialMessage(tutorProfile);
    console.log(`[sessions/start] Got initial message, sessionId=${sessionId}`);

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
    return res.json({ sessionId, message: initialMessage });
  } catch (err) {
    console.error('[sessions/start] Error:', err);
    next(err);
  }
});

router.post('/:sessionId/message', async (req: Request, res: Response, next: NextFunction) => {
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

    console.log(`[sessions/message] sessionId=${sessionId}, calling OpenRouter`);
    const rawResponse = await continueConversation(session.tutorProfile, session.messages);
    console.log(`[sessions/message] sessionId=${sessionId}, got response`);

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
  } catch (err) {
    console.error(`[sessions/message] Error for sessionId=${req.params['sessionId']}:`, err);
    next(err);
  }
});

router.get('/:sessionId', (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = sessions.get(req.params['sessionId'] as string);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    return res.json(session);
  } catch (err) {
    console.error(`[sessions/get] Error:`, err);
    next(err);
  }
});

router.get('/', (_req: Request, res: Response, next: NextFunction) => {
  try {
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
  } catch (err) {
    console.error('[sessions/list] Error:', err);
    next(err);
  }
});

export default router;
