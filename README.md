# InterviewLab

AI-assisted interview practice for software engineering candidates. The app creates role-specific interview questions and gives structured coaching feedback using Gemini.

## Run locally

Requirements: Node.js 20+ and npm. Copy the API environment template and set the services you have configured:

```bash
npm install
cp apps/api/.env.example apps/api/.env
# Add GEMINI_API_KEY. Add MONGODB_URI and JWT_SECRET to enable accounts and saved history.
npm run dev
```

Open the Vite URL shown in the terminal (normally `http://localhost:5173`). Without a Gemini key, the UI loads but AI generation returns a setup message.

## Workspace

- `apps/web` — React + TypeScript client.
- `apps/api` — Express API and server-side Gemini integration.
- `packages/shared` — shared Zod validation schemas and types.
- `ARCHITECTURE.md` — product scope, architecture, security, and deployment plan.

## Environment

Set `GEMINI_API_KEY` and optionally `GEMINI_MODEL` in the API host environment. Set `MONGODB_URI` and a long random `JWT_SECRET` to enable account and history routes. The default model is configurable; confirm model availability and free-tier quota in Google AI Studio before deployment. Never commit `.env` files or paste the key into client-side code.

## Deploy

This repository includes a Vercel configuration for the React frontend and a Render Blueprint for the Express API. MongoDB Atlas remains a separately managed database.

1. Push this repository to GitHub and connect it to Vercel and Render.
2. In Render, create the `interviewlab-api` Blueprint from `render.yaml`. Set `GEMINI_API_KEY`, `MONGODB_URI`, and `WEB_ORIGIN` in the Render service environment. `WEB_ORIGIN` accepts a comma-separated list of exact frontend origins. Render generates `JWT_SECRET` for the service.
3. Deploy the API and copy its HTTPS `onrender.com` origin.
4. In Vercel, import the repository with the repository root as the project root. Set `VITE_API_BASE_URL` to the Render API origin (no trailing slash), then deploy the frontend.
5. Copy the Vercel production origin into Render's `WEB_ORIGIN` setting and redeploy the API. Add any custom frontend domain to the same comma-separated setting.
6. Confirm `https://<api-origin>/api/v1/health` reports `status: "ok"`, `databaseConnected: true`, and `aiConfigured: true`. Then try signup, sign-in, a short interview, report generation, and session history on the deployed site.

Keep `GEMINI_API_KEY`, `MONGODB_URI`, and `JWT_SECRET` in host environment settings. Never add them to Vercel or frontend source. Render's free web services can sleep after 15 minutes without traffic, so the first request after inactivity may take about a minute to wake up. See [Render's free service limits](https://render.com/docs/free).

## Current scope

Implemented flows include the landing/demo pages, JWT signup/login, role/stack interview setup, PDF resume extraction, job-description context, one-question-at-a-time practice, consolidated structured feedback (including STAR review for behavioral rounds), saved session history, score/weak-topic analytics, article-style CS fundamentals, and coding practice with progressive Gemini hints and static solution review. A GitHub remote and hosted environment values are required before the app can be published.
