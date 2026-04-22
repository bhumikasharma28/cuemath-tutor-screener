import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import sessionRouter from '../backend/src/routes/session';

dotenv.config();

if (!process.env.OPENROUTER_API_KEY) {
  console.error('[api] OPENROUTER_API_KEY is not set — all AI requests will fail.');
}

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

app.use('/api/sessions', sessionRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[ERROR] ${req.method} ${req.url} →`, err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal server error', message });
  }
});

export default app;
