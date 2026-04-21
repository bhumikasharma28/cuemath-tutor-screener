import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import sessionRouter from './routes/session';

dotenv.config();

if (!process.env.OPENROUTER_API_KEY) {
  console.error('ERROR: OPENROUTER_API_KEY environment variable is required.');
  console.error('Create a .env file in the backend directory with: OPENROUTER_API_KEY=your_key');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json());

app.use('/api/sessions', sessionRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`✓ Cuemath Tutor Screener API running on http://localhost:${PORT}`);
  console.log(`✓ Accepting requests from ${FRONTEND_URL}`);
});
