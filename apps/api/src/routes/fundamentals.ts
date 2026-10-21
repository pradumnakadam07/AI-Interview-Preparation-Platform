import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { User } from "../models/User.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";

export const fundamentalsRouter = Router();
fundamentalsRouter.use(requireAuth);

function databaseUnavailable(res: import("express").Response) {
  return res.status(503).json({ code: "DATABASE_UNAVAILABLE", message: "Study progress is temporarily unavailable. Please try again shortly." });
}

fundamentalsRouter.get("/progress", async (req: AuthenticatedRequest, res) => {
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);
  const user = await User.findById(req.userId).select("revisedTopics").lean();
  if (!user) return res.status(404).json({ code: "NOT_FOUND", message: "Your account could not be found." });
  res.json({ revisedTopics: user.revisedTopics ?? [] });
});

fundamentalsRouter.put("/progress", async (req: AuthenticatedRequest, res) => {
  const parsed = z.object({ topicKey: z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+$/), revised: z.boolean() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ code: "INVALID_INPUT", message: "That revision update is invalid." });
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);
  const update = parsed.data.revised
    ? { $addToSet: { revisedTopics: parsed.data.topicKey } }
    : { $pull: { revisedTopics: parsed.data.topicKey } };
  const user = await User.findByIdAndUpdate(req.userId, update, { new: true }).select("revisedTopics").lean();
  if (!user) return res.status(404).json({ code: "NOT_FOUND", message: "Your account could not be found." });
  res.json({ revisedTopics: user.revisedTopics ?? [] });
});
