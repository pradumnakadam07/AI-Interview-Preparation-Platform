import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import mongoose from "mongoose";
import multer from "multer";
import { answerSchema, interviewSetupSchema } from "@prep/shared";
import { authRouter } from "./routes/auth.js";
import { resumeRouter } from "./routes/resume.js";
import { sessionsRouter } from "./routes/sessions.js";
import { fundamentalsRouter } from "./routes/fundamentals.js";
import { codingRouter } from "./routes/coding.js";
import { evaluateAnswer, generateQuestions } from "./services/gemini.js";

loadEnv({ path: fileURLToPath(new URL("../.env", import.meta.url)) });

const app = express();
const port = Number(process.env.PORT ?? 4000);
const allowedWebOrigins = (process.env.WEB_ORIGIN ?? "http://localhost:5173").split(",").map((origin) => origin.trim()).filter(Boolean);
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: "draft-8", legacyHeaders: false });
const aiLimiter = rateLimit({ windowMs: 24 * 60 * 60 * 1000, limit: Number(process.env.AI_DAILY_LIMIT ?? 30), standardHeaders: "draft-8", legacyHeaders: false, message: { code: "DAILY_LIMIT_REACHED", message: "You've reached today's AI practice limit. Come back tomorrow to keep practicing." } });

app.use(helmet());
app.use(cors({ origin: (origin, callback) => {
  if (!origin || allowedWebOrigins.includes(origin)) return callback(null, true);
  callback(new Error("Origin is not allowed by CORS"));
} }));
app.use(express.json({ limit: "32kb" }));
app.use("/api/v1", apiLimiter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/resumes", resumeRouter);
app.use("/api/v1/sessions", sessionsRouter);
app.use("/api/v1/fundamentals", fundamentalsRouter);
app.use("/api/v1/coding", codingRouter);

app.get("/api/v1/health", (_req, res) => {
  res.json({ status: "ok", aiConfigured: Boolean(process.env.GEMINI_API_KEY), databaseConnected: mongoose.connection.readyState === 1 });
});

app.post("/api/v1/questions", aiLimiter, async (req, res) => {
  const parsed = interviewSetupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ code: "INVALID_INPUT", message: "Check your interview setup and try again." });
  if (!process.env.GEMINI_API_KEY) return res.status(503).json({ code: "AI_NOT_CONFIGURED", message: "AI practice is not configured yet. Add a Gemini API key to the API environment." });

  try {
    const questions = await generateQuestions(parsed.data);
    res.json({ questions });
  } catch (error) {
    console.error("Question generation failed", error instanceof Error ? error.message : "Unknown error");
    res.status(502).json({ code: "AI_UNAVAILABLE", message: "Gemini is temporarily unavailable. Please try again shortly." });
  }
});

app.post("/api/v1/feedback", aiLimiter, async (req, res) => {
  const parsed = answerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ code: "INVALID_INPUT", message: "Add an answer of at least 10 characters." });
  if (!process.env.GEMINI_API_KEY) return res.status(503).json({ code: "AI_NOT_CONFIGURED", message: "AI feedback is not configured yet. Add a Gemini API key to the API environment." });

  try {
    const result = await evaluateAnswer(parsed.data.question, parsed.data.answer);
    res.json(result);
  } catch (error) {
    console.error("Feedback generation failed", error instanceof Error ? error.message : "Unknown error");
    res.status(502).json({ code: "AI_UNAVAILABLE", message: "Gemini is temporarily unavailable. Please try again shortly." });
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof multer.MulterError) {
    const tooLarge = error.code === "LIMIT_FILE_SIZE";
    return res.status(tooLarge ? 413 : 400).json({ code: tooLarge ? "FILE_TOO_LARGE" : "INVALID_UPLOAD", message: tooLarge ? "Choose a PDF under 4 MB." : "Choose a single PDF resume." });
  }
  console.error("Unhandled API error", error instanceof Error ? error.message : "Unknown error");
  res.status(500).json({ code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." });
});

if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log("MongoDB connected"))
    .catch((error: unknown) => console.error("MongoDB connection failed", error instanceof Error ? error.message : "Unknown error"));
} else {
  console.warn("MONGODB_URI is not configured; account and history routes are unavailable.");
}

app.listen(port, () => console.log(`Interview prep API listening on port ${port}`));
