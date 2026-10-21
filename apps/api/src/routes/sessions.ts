import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { interviewSetupSchema } from "@prep/shared";
import { InterviewSession } from "../models/InterviewSession.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { evaluateAnswers, generateQuestions } from "../services/gemini.js";

export const sessionsRouter = Router();
sessionsRouter.use(requireAuth);

const answerInput = z.object({
  order: z.number().int().min(0).max(9),
  answer: z.string().trim().min(10).max(6000),
  durationSeconds: z.number().int().min(0).max(7200).optional(),
});

function databaseUnavailable(res: import("express").Response) {
  return res.status(503).json({ code: "DATABASE_UNAVAILABLE", message: "Saved interviews are temporarily unavailable. Please try again shortly." });
}

sessionsRouter.post("/", async (req: AuthenticatedRequest, res) => {
  const parsed = interviewSetupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ code: "INVALID_INPUT", message: "Check your interview setup and try again." });
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const sessionsToday = await InterviewSession.countDocuments({ userId: req.userId, createdAt: { $gte: today } });
    if (sessionsToday >= 3) return res.status(429).json({ code: "DAILY_SESSION_LIMIT", message: "You can start up to 3 AI interview sessions a day. Come back tomorrow for more." });
    const questions = await generateQuestions(parsed.data);
    const session = await InterviewSession.create({ userId: req.userId, ...parsed.data, questions });
    res.status(201).json({ session: { id: session.id, role: session.role, level: session.level, mode: session.mode, questions: session.questions, status: session.status, startedAt: session.startedAt } });
  } catch (error) {
    const status = (error as { status?: number; code?: number }).status ?? (error as { code?: number }).code;
    if (status === 429 || status === 8) return res.status(429).json({ code: "GEMINI_QUOTA", message: "Gemini is at its current free-tier limit. Please try again later." });
    console.error("Session creation failed", error instanceof Error ? error.message : "Unknown error");
    res.status(502).json({ code: "AI_UNAVAILABLE", message: "The interview session could not be prepared. Please try again shortly." });
  }
});

sessionsRouter.get("/", async (req: AuthenticatedRequest, res) => {
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(25, Math.max(1, Number(req.query.limit) || 10));
  const [sessions, total] = await Promise.all([
    InterviewSession.find({ userId: req.userId }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).select("role level mode status averageScore startedAt completedAt createdAt").lean(),
    InterviewSession.countDocuments({ userId: req.userId }),
  ]);
  res.json({ sessions: sessions.map((session) => ({ ...session, id: String(session._id) })), page, limit, total, pages: Math.ceil(total / limit) });
});

sessionsRouter.get("/:id", async (req: AuthenticatedRequest, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ code: "NOT_FOUND", message: "That interview session could not be found." });
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);
  const session = await InterviewSession.findOne({ _id: req.params.id, userId: req.userId }).lean();
  if (!session) return res.status(404).json({ code: "NOT_FOUND", message: "That interview session could not be found." });
  res.json({ session: { ...session, id: String(session._id) } });
});

sessionsRouter.post("/:id/answers", async (req: AuthenticatedRequest, res) => {
  const parsed = answerInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ code: "INVALID_INPUT", message: "Write an answer of at least 10 characters." });
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ code: "NOT_FOUND", message: "That interview session could not be found." });
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);
  const session = await InterviewSession.findOne({ _id: req.params.id, userId: req.userId });
  if (!session) return res.status(404).json({ code: "NOT_FOUND", message: "That interview session could not be found." });
  if (session.status !== "in_progress") return res.status(409).json({ code: "SESSION_COMPLETE", message: "This session has already been completed." });
  if (parsed.data.order < session.answers.length) {
    const savedAnswer = session.answers[parsed.data.order];
    if (savedAnswer?.answerText === parsed.data.answer) {
      return res.json({ answer: { order: parsed.data.order, question: savedAnswer.question, answer: savedAnswer.answerText }, alreadySaved: true });
    }
    return res.status(409).json({ code: "QUESTION_ORDER", message: "This question already has a saved answer. Reload the interview to continue." });
  }
  if (parsed.data.order !== session.answers.length || !session.questions[parsed.data.order]) return res.status(409).json({ code: "QUESTION_ORDER", message: "Answer the current question before moving ahead." });
  const savedAnswer = { question: session.questions[parsed.data.order]!, answerText: parsed.data.answer, durationSeconds: parsed.data.durationSeconds, feedback: {}, weakTopics: [], createdAt: new Date() };
  try {
    const update = await InterviewSession.updateOne(
      { _id: session._id, userId: req.userId, status: "in_progress", answers: { $size: parsed.data.order } },
      { $push: { answers: savedAnswer } },
    );
    if (update.modifiedCount === 0) {
      const latest = await InterviewSession.findOne({ _id: session._id, userId: req.userId }).select("answers").lean();
      const alreadySaved = latest?.answers[parsed.data.order];
      if (alreadySaved?.answerText === parsed.data.answer) {
        return res.json({ answer: { order: parsed.data.order, question: alreadySaved.question, answer: alreadySaved.answerText }, alreadySaved: true });
      }
      return res.status(409).json({ code: "QUESTION_ORDER", message: "This answer could not be added because the interview moved forward. Reload the interview to continue." });
    }
  } catch (error) {
    console.error("Interview answer save failed", { order: parsed.data.order, error: error instanceof Error ? error.message : "Unknown error" });
    return res.status(500).json({ code: "ANSWER_SAVE_FAILED", message: "We couldn't save this answer just now. Your answer is still on the screen; please retry." });
  }
  res.json({ answer: { order: parsed.data.order, question: savedAnswer.question, answer: savedAnswer.answerText } });
});

sessionsRouter.post("/:id/complete", async (req: AuthenticatedRequest, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ code: "NOT_FOUND", message: "That interview session could not be found." });
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);
  const session = await InterviewSession.findOne({ _id: req.params.id, userId: req.userId });
  if (!session) return res.status(404).json({ code: "NOT_FOUND", message: "That interview session could not be found." });
  if (session.status === "completed") return res.json({ session: { id: session.id, status: session.status, averageScore: session.averageScore, completedAt: session.completedAt } });
  if (session.answers.length !== session.questions.length) return res.status(409).json({ code: "ANSWERS_INCOMPLETE", message: "Answer every interview question before generating your final report." });
  try {
    const feedback = await evaluateAnswers(session.answers.map((answer) => ({ question: answer.question, answer: answer.answerText })), session.mode);
    session.answers.forEach((answer, index) => {
      answer.feedback = feedback[index]!;
      answer.weakTopics = feedback[index]!.weakTopics;
    });
    const scoreTotal = feedback.reduce((sum, item) => sum + item.scores.correctness + item.scores.clarity + item.scores.depth, 0);
    session.averageScore = Math.round((scoreTotal / (feedback.length * 3)) * 100) / 100;
    session.status = "completed";
    session.completedAt = new Date();
    await session.save();
    res.json({ session: { id: session.id, status: session.status, averageScore: session.averageScore, completedAt: session.completedAt } });
  } catch (error) {
    const details = error as { status?: number | string; code?: number | string; message?: string };
    const diagnostic = `${details.status ?? ""} ${details.code ?? ""} ${details.message ?? (error instanceof Error ? error.message : "Unknown error")}`;
    if (/429|RESOURCE_EXHAUSTED|RATE[_ ]LIMIT|QUOTA/i.test(diagnostic)) return res.status(429).json({ code: "GEMINI_QUOTA", message: "Gemini's free-tier limit was reached. Your answers are saved; wait for the limit to reset, then select Generate final report to try again." });
    console.error("Interview report generation failed", { status: details.status, code: details.code, message: details.message ?? (error instanceof Error ? error.message : "Unknown error") });
    if (error instanceof SyntaxError || /incomplete interview report|validation/i.test(diagnostic)) {
      return res.status(502).json({ code: "AI_REPORT_FORMAT", message: "Gemini returned an incomplete report. Your answers are saved; select Generate final report to retry." });
    }
    res.status(502).json({ code: "AI_UNAVAILABLE", message: "The AI report service is temporarily unavailable. Your answers are saved; select Generate final report to retry." });
  }
});

sessionsRouter.get("/analytics/summary", async (req: AuthenticatedRequest, res) => {
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);
  const sessions = await InterviewSession.find({ userId: req.userId, status: "completed" }).sort({ completedAt: -1 }).limit(100).select("averageScore completedAt answers.weakTopics").lean();
  const topicCounts = new Map<string, number>();
  for (const session of sessions) for (const answer of session.answers) for (const topic of answer.weakTopics ?? []) topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);
  const weakTopics = [...topicCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([topic, count]) => ({ topic, count }));
  const trend = [...sessions].reverse().map((session) => ({ date: session.completedAt, score: session.averageScore ?? 0 }));
  const averageScore = sessions.length ? Math.round((sessions.reduce((sum, session) => sum + (session.averageScore ?? 0), 0) / sessions.length) * 100) / 100 : 0;
  res.json({ completedSessions: sessions.length, averageScore, trend, weakTopics });
});
