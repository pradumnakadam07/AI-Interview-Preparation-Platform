import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export interface AuthenticatedRequest extends Request { userId?: string }

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = req.header("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const secret = process.env.JWT_SECRET;
  if (!token || !secret) return res.status(401).json({ code: "UNAUTHORIZED", message: "Sign in to continue." });
  try {
    const payload = jwt.verify(token, secret);
    if (typeof payload === "string" || !payload.sub) throw new Error("Invalid token payload");
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ code: "UNAUTHORIZED", message: "Your session has expired. Sign in again." });
  }
}
