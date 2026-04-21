# Cuemath AI Tutor Screener

A complete AI-powered screening system for evaluating Cuemath tutor candidates across 3 stages: math competency, teaching simulation, and behavioral fit.

## Architecture

```
cuemath-tutor-screener/
├── backend/          Node.js + Express + TypeScript + OpenRouter API (fetch)
└── frontend/         React + TypeScript + Vite + Tailwind CSS
```

## Quick Start

### 1. Backend Setup

```bash
cd backend
cp ../.env.example .env
# Edit .env and add your OPENROUTER_API_KEY
npm install
npm run dev
```

Backend runs on `http://localhost:3001`

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`

## Screening Flow

| Stage | Content | Questions |
|-------|---------|-----------|
| 1 – Math Competency | Graded math problems calibrated to tutor's level | 4 |
| 2 – Teaching Simulation | AI acts as confused student; tutor must explain | 2 scenarios |
| 3 – Behavioral Fit | Situational teaching questions | 3 |

## Scoring

| Score | Recommendation |
|-------|----------------|
| 75–100 | **Hire** |
| 55–74 | **Hold** (needs development) |
| 0–54 | **Reject** |

Weights: Math Competency 40% · Teaching Ability 40% · Communication 20%

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/sessions/start` | Start a new screening session |
| POST | `/api/sessions/:id/message` | Send a message, get AI response |
| GET | `/api/sessions/:id` | Get full session data |
| GET | `/api/sessions` | List all sessions (admin) |

## Key Features

- **OpenRouter + Llama 3.1 8B** — uses `meta-llama/llama-3.1-8b-instruct` via `fetch` with no SDK dependency
- **Adaptive difficulty** — model calibrates math questions to the tutor's stated grade level
- **Structured evaluation** — JSON report parsed from `<evaluation>...</evaluation>` tags in the final AI message
- **Print-ready report** — Results page is print/PDF friendly
