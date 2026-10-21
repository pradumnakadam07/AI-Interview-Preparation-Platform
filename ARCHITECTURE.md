# AI Interview Preparation Platform — Architecture

## Product goal

A polished, public portfolio project that helps a candidate practice role-specific interviews, receive useful feedback, and track improvement over time. The MVP should be small enough to ship, but structured so it can grow into a full interview coaching product.

## Who it serves and core loop

1. Candidate signs up or enters demo mode, then chooses role, stack, difficulty, interview style, and question count.
2. The app creates a session and asks one question at a time, optionally grounded in an uploaded resume or pasted job description.
3. Candidate answers by text or browser speech input.
4. Gemini evaluates correctness, clarity, and depth with structured feedback, an ideal answer, and specific improvements. Behavioral answers also receive STAR-method feedback.
5. Each completed answer and session is saved, then shown in history and dashboard trends.

## MVP scope (build in this order)

### Must have for a credible live launch

- Landing page with a clear demo and sample feedback.
- Sign up / sign in with JWT, profile, and target role settings.
- Interview setup: role, tech stack, difficulty, behavioral / technical / mixed mode, question count, and optional job description.
- Guided session UI: one question at a time, answer editor, progress, skip, and finish.
- AI feedback: structured scores for correctness, clarity, and depth; evidence-based strengths, improvement points, and an ideal answer.
- Resume PDF upload and extraction, then questions grounded in the candidate's projects and skills.
- Session history and detail page; dashboard with score trends, weak topics, and completed-session counts.
- Responsive, accessible UI, loading/error states, privacy notice, and a seeded demo path for visitors.

### Strong additions selected for the first release

- Voice answers using browser Web Speech APIs, with text input as the fallback.
- HR/behavioral round with STAR-method feedback.
- Job-description mode for tailored questions.

Keep coding editor, downloadable reports, video recording, proctoring, and payments out of the first release; revisit after the core journey is reliable.

## Recommended stack

| Area | Choice | Reason |
| --- | --- | --- |
| Frontend | React + TypeScript + Vite | Fast iteration, strong portfolio visibility, simple static deployment |
| UI | React Router, Tailwind CSS, accessible component primitives, React Hook Form + Zod, Recharts | Clear navigation, consistent styling, validated forms, and dashboard charts |
| API | Node.js + TypeScript + Express | Familiar REST API and straightforward Gemini integration |
| Data | MongoDB Atlas + Mongoose | Fits session/question/feedback documents and has a straightforward hosted option |
| Authentication | JWT access tokens, bcrypt password hashing, Zod validation | Explicit JWT requirement; keep access tokens short-lived and passwords hashed server-side |
| AI | Official Google GenAI SDK on the server | Keeps the Gemini key private and supports current Gemini models |
| Hosting | Vercel (web) + Render (API) + managed MongoDB | Simple independent deploys; verify current free-plan limits before launch |
| Operations | GitHub Actions, structured logs, uptime/error tracking, express-rate-limit | Repeatable deploys, quota protection, and enough visibility to debug a public demo |

Use TypeScript end to end. Keep API contracts in shared schemas/types or generate an OpenAPI specification so the browser and server agree on request/response shapes.

## High-level architecture

```text
Browser (React)
  ├── Auth provider (session/JWT)
  └── HTTPS JSON API
        ↓
Node/Express API
  ├── JWT auth + ownership checks
  ├── Validation, per-user/IP rate limits, daily quotas
  ├── Interview/session service
  ├── Feedback service ── Gemini API (server-side key only)
  ├── MongoDB Atlas (users, sessions, answers)
  └── memory cache (initial question-set cache; Redis can replace it later)
```

The browser never calls Gemini directly. The API authenticates the user, validates inputs, applies usage limits, builds a constrained prompt, calls Gemini, validates the response, stores the result, and returns a typed response. Resume text and answers are user-provided data, never model instructions. Persist user content only when needed for history and explain retention in the product. Demo mode uses seeded sample sessions and does not call Gemini.

## Core data model

- **User**: email, passwordHash, display name, target roles, experience level, preferences, createdAt.
- **InterviewSession**: userId, role, level, mode, jobDescriptionText (optional), status, startedAt, completedAt, model/prompt version, aggregate scores.
- **QuestionAnswer**: sessionId, order, question, answerText, durationSeconds, feedback object, weakTopics, createdAt.
- **Feedback**: rubric scores, strengths, improvements, evidence snippets, improvedAnswer, followUpQuestion (optional). Store as validated structured data, not an unparsed model blob.
- **UsageEvent**: userId/sessionId, operation, token or request metadata where available, result, timestamp. Never store API secrets.

Add indexes on `userId + createdAt` for history and `sessionId + order` for session retrieval. Every session read or mutation must verify its userId on the server.

## Initial API surface

- `POST /api/v1/auth/register` and `/login` — create account or return JWT.
- `GET /api/v1/me` — current profile.
- `PATCH /api/v1/me` — profile/preferences.
- `POST /api/v1/resumes` — validate and extract an uploaded PDF.
- `POST /api/v1/sessions` — create a session and generate its question set.
- `GET /api/v1/sessions` — paginated current-user history.
- `GET /api/v1/sessions/:id` — owned session details.
- `POST /api/v1/sessions/:id/answers` — save an answer and request feedback.
- `POST /api/v1/sessions/:id/complete` — complete and summarize the session.
- `GET /api/v1/analytics/summary` — score trends, weak topics, and completed-session count.
- `GET /api/v1/health` — health check without exposing environment or dependency secrets.

Validate all inputs with Zod. Use consistent error responses (`code`, human-safe `message`, optional `requestId`) and pagination. Do not return stack traces or provider error bodies to the browser.

## Gemini integration and free-tier guardrails

- Keep `GEMINI_API_KEY` only in the API host's secret environment settings; keep `.env` out of Git and commit `.env.example` with placeholder names only.
- Use a model that is currently available to the user's free-tier project; choose the model via server configuration (`GEMINI_MODEL`) so it can be changed without frontend edits.
- Ask for JSON matching a strict schema, validate it server-side, and retry at most once for malformed output. Keep prompts short and outputs capped to control quota usage.
- Add per-user and per-IP limits, a daily session/feedback cap, request timeouts, and graceful handling for quota/rate-limit (`429`) and provider failures. Keep demo data available if Gemini is unavailable.
- Don't promise a particular free quota or model. Check the active quotas in Google AI Studio before launch; free-tier terms and availability can change. Google's pricing docs also state that free-tier submitted content may be used to improve products, so tell users clearly and avoid sending unnecessary personal/sensitive information.
- Record model name, prompt version, latency, and success/failure for debugging, but do not log API keys, full resumes, or sensitive answers by default.

## Security, privacy, and quality requirements

- Use HTTPS, secure auth cookies or a vetted auth SDK, CORS allow-list, security headers, input size limits, and server-side authorization on every user-owned resource.
- Treat answers and job descriptions as untrusted text; delimit them in prompts and instruct the model not to follow embedded instructions. Do not let model output execute code or trigger arbitrary tools.
- Provide account/data deletion and a clear retention policy before public launch. Don't claim the AI score is an objective hiring prediction; present it as coaching feedback.
- Include keyboard navigation, visible focus, semantic labels, contrast checks, and mobile layouts.
- Keep secrets out of source control and logs. Restrict the Gemini key to the Gemini API where supported, monitor usage, and rotate it immediately if exposed.

## Repository layout

```text
apps/
  web/                 # React + Vite client
  api/                 # Express API, Gemini adapter, persistence
packages/
  shared/              # Zod schemas and shared API types
docs/
  architecture.md      # This design (or keep at repository root)
.github/workflows/     # lint/typecheck/build/deploy automation
```

Each app has its own environment example and README. Keep Gemini-specific code behind a `GeminiProvider` interface so prompts, model versions, and later providers are isolated from route handlers.

## Deployment plan

1. Create a GitHub repository and establish `main` plus short-lived feature branches.
2. Deploy the API and web app separately; provision the database and configure production secrets in the host dashboard.
3. Configure frontend API base URL, backend CORS origin, auth callback URLs, and production domain.
4. Set up database backups/access rules, health checks, basic request/error monitoring, and Gemini usage alerts/limits where available.
5. Seed a demo session that uses stored sample feedback and does not consume Gemini quota.
6. Verify the public flow: sign-up, session creation, feedback, history, mobile UI, deletion, and recovery when Gemini is rate-limited.
7. Add the live URL, screenshots, architecture summary, and a short demo GIF/video to the project README for the resume.

Free hosting plans may sleep, restrict usage, or change. Confirm current limits and the Gemini project's active free quota before publishing a reliability promise; the portfolio demo should explain any cold start.

## Build milestones

1. **Foundation**: repository, shared schemas, React shell, API health check, database connection, deployment preview.
2. **Product core**: authentication/profile, session setup, question generation, answer flow, persistence/history.
3. **Coaching**: structured Gemini feedback, quota/rate protection, demo fallback, progress summary.
4. **Launch polish**: accessibility/responsive pass, privacy/deletion flow, error monitoring, README/screenshots, production deploy.

## Decisions to make before coding

- Pick the auth provider and whether users can try a no-account demo.
- Pick the target audience for the first release (e.g. software engineering roles) rather than trying to cover every job family immediately.
- Decide the initial supported interview modes and question count.
- Confirm the Gemini API key's project, model access, and active free quota in AI Studio. Do not paste the key into chat or commit it.
