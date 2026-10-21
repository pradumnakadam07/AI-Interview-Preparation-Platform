import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { loginSchema, registerSchema } from "@prep/shared";
import { User } from "../models/User.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import rateLimit from "express-rate-limit";

export const authRouter = Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: "draft-8", legacyHeaders: false, message: { code: "AUTH_RATE_LIMITED", message: "Too many sign-in attempts. Please wait a little and try again." } });
authRouter.use(authLimiter);
const jwtOptions: jwt.SignOptions = { expiresIn: "2h" };

function unavailable(res: import("express").Response) {
  const message = process.env.NODE_ENV === "development"
    ? "MongoDB is not connected. Add MONGODB_URI to apps/api/.env, then restart the API."
    : "Accounts are temporarily unavailable. Please try again shortly.";
  return res.status(503).json({ code: "DATABASE_UNAVAILABLE", message });
}

function issueToken(userId: string) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT secret is not configured");
  return jwt.sign({}, secret, { ...jwtOptions, subject: userId });
}

authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ code: "INVALID_INPUT", message: "Enter a name, valid email, and password with at least 10 characters." });
  if (mongoose.connection.readyState !== 1) return unavailable(res);
  if (!process.env.JWT_SECRET) return res.status(503).json({ code: "AUTH_NOT_CONFIGURED", message: process.env.NODE_ENV === "development" ? "JWT_SECRET is missing from apps/api/.env. Add it and restart the API." : "Authentication is not configured yet." });
  try {
    const existing = await User.findOne({ email: parsed.data.email }).lean();
    if (existing) return res.status(409).json({ code: "EMAIL_IN_USE", message: "An account with this email already exists." });
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const user = await User.create({ name: parsed.data.name, email: parsed.data.email, passwordHash });
    res.status(201).json({ token: issueToken(user.id), user: { id: user.id, name: user.name, email: user.email } });
  } catch (error) {
    if (error instanceof mongoose.Error) return res.status(400).json({ code: "ACCOUNT_CREATE_FAILED", message: "Your account could not be created. Check the details and retry." });
    console.error("Registration failed", error instanceof Error ? error.message : "Unknown error");
    res.status(500).json({ code: "INTERNAL_ERROR", message: "Your account could not be created right now." });
  }
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ code: "INVALID_INPUT", message: "Enter a valid email and password." });
  if (mongoose.connection.readyState !== 1) return unavailable(res);
  if (!process.env.JWT_SECRET) return res.status(503).json({ code: "AUTH_NOT_CONFIGURED", message: process.env.NODE_ENV === "development" ? "JWT_SECRET is missing from apps/api/.env. Add it and restart the API." : "Authentication is not configured yet." });
  try {
    const user = await User.findOne({ email: parsed.data.email }).select("+passwordHash");
    const passwordMatches = user ? await bcrypt.compare(parsed.data.password, user.passwordHash) : false;
    if (!user || !passwordMatches) return res.status(401).json({ code: "INVALID_CREDENTIALS", message: "Email or password is incorrect." });
    res.json({ token: issueToken(user.id), user: { id: user.id, name: user.name, email: user.email } });
  } catch (error) {
    console.error("Login failed", error instanceof Error ? error.message : "Unknown error");
    res.status(500).json({ code: "INTERNAL_ERROR", message: "Sign in could not be completed right now." });
  }
});

authRouter.get("/me", requireAuth, async (req: AuthenticatedRequest, res) => {
  if (mongoose.connection.readyState !== 1) return unavailable(res);
  const user = await User.findById(req.userId).select("name email createdAt").lean();
  if (!user) return res.status(401).json({ code: "UNAUTHORIZED", message: "This account is no longer available." });
  res.json({ user: { id: String(user._id), name: user.name, email: user.email, createdAt: user.createdAt } });
});
