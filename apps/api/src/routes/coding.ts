import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { reviewCodingSolution, suggestCodingHint } from "../services/gemini.js";

export const codingRouter = Router();
codingRouter.use(requireAuth);
codingRouter.use(rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: Number(process.env.CODING_AI_DAILY_LIMIT ?? 20),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => (req as AuthenticatedRequest).userId ?? req.ip ?? "unknown",
  message: { code: "CODING_DAILY_LIMIT", message: "You have reached today's coding coach limit. Your drafts are saved locally; try again tomorrow." },
}));

const contextSchema = z.object({
  problemTitle: z.string().trim().min(3).max(120),
  problemStatement: z.string().trim().min(20).max(5000),
  language: z.enum(["javascript", "typescript", "python", "java", "cpp"]),
});

codingRouter.post("/hint", async (req, res) => {
  const parsed = contextSchema.extend({ hintLevel: z.number().int().min(1).max(3), solution: z.string().max(12000).optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ code: "INVALID_INPUT", message: "Choose a problem and a valid hint level." });
  if (!process.env.GEMINI_API_KEY) return res.status(503).json({ code: "AI_NOT_CONFIGURED", message: "Coding hints are unavailable until the Gemini API key is configured." });
  try {
    const hint = await suggestCodingHint(parsed.data);
    res.json({ hint });
  } catch (error) {
    const status = (error as { status?: number; code?: number }).status ?? (error as { code?: number }).code;
    if (status === 429 || status === 8) return res.status(429).json({ code: "GEMINI_QUOTA", message: "Gemini has reached its current free-tier limit. Please try again later." });
    console.error("Coding hint failed", error instanceof Error ? error.message : "Unknown error");
    res.status(502).json({ code: "AI_UNAVAILABLE", message: "The hint could not be generated. Please try again shortly." });
  }
});

codingRouter.post("/review", async (req, res) => {
  const parsed = contextSchema.extend({ solution: z.string().trim().min(10).max(12000) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ code: "INVALID_INPUT", message: "Paste a solution of at least 10 characters." });
  if (!process.env.GEMINI_API_KEY) return res.status(503).json({ code: "AI_NOT_CONFIGURED", message: "Solution review is unavailable until the Gemini API key is configured." });
  try {
    const review = await reviewCodingSolution(parsed.data);
    res.json(review);
  } catch (error) {
    const status = (error as { status?: number; code?: number }).status ?? (error as { code?: number }).code;
    if (status === 429 || status === 8) return res.status(429).json({ code: "GEMINI_QUOTA", message: "Gemini has reached its current free-tier limit. Please try again later." });
    console.error("Coding solution review failed", error instanceof Error ? error.message : "Unknown error");
    res.status(502).json({ code: "AI_UNAVAILABLE", message: "The solution could not be reviewed. Please try again shortly." });
  }
});
