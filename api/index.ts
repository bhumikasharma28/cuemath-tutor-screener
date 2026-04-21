import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import sessionRouter from '../backend/src/routes/session';

dotenv.config();

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

app.use('/api/sessions', sessionRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default app;
