"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const uuid_1 = require("uuid");
const openrouter_1 = require("../services/openrouter");
const router = (0, express_1.Router)();
const sessions = new Map();
router.post('/start', async (req, res, next) => {
    try {
        const { tutorProfile } = req.body;
        if (!tutorProfile?.name || !tutorProfile?.email) {
            return res.status(400).json({ error: 'Missing required profile fields' });
        }
        const sessionId = (0, uuid_1.v4)();
        const firstUserMessage = `Hi! I'm ${tutorProfile.name} and I'm ready to start the Cuemath tutor screening.`;
        console.log(`[sessions/start] Starting session for ${tutorProfile.email}`);
        const initialMessage = await (0, openrouter_1.getInitialMessage)(tutorProfile);
        console.log(`[sessions/start] Got initial message, sessionId=${sessionId}`);
        const session = {
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
    }
    catch (err) {
        console.error('[sessions/start] Error:', err);
        next(err);
    }
});
router.post('/:sessionId/message', async (req, res, next) => {
    try {
        const sessionId = req.params['sessionId'];
        const { message } = req.body;
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
        const rawResponse = await (0, openrouter_1.continueConversation)(session.tutorProfile, session.messages);
        console.log(`[sessions/message] sessionId=${sessionId}, got response`);
        const evaluation = (0, openrouter_1.parseEvaluation)(rawResponse);
        const displayMessage = evaluation ? (0, openrouter_1.stripEvaluationBlock)(rawResponse) : rawResponse;
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
    }
    catch (err) {
        console.error(`[sessions/message] Error for sessionId=${req.params['sessionId']}:`, err);
        next(err);
    }
});
router.get('/:sessionId', (req, res, next) => {
    try {
        const session = sessions.get(req.params['sessionId']);
        if (!session)
            return res.status(404).json({ error: 'Session not found' });
        return res.json(session);
    }
    catch (err) {
        console.error(`[sessions/get] Error:`, err);
        next(err);
    }
});
router.get('/', (_req, res, next) => {
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
    }
    catch (err) {
        console.error('[sessions/list] Error:', err);
        next(err);
    }
});
exports.default = router;
