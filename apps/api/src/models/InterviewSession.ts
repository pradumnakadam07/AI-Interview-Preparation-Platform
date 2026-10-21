import mongoose, { type Model, type Types } from "mongoose";

export interface SessionAnswer {
  question: string;
  answerText: string;
  durationSeconds?: number;
  feedback: unknown;
  weakTopics: string[];
  createdAt: Date;
}

export interface InterviewSessionDocument {
  userId: Types.ObjectId;
  role: string;
  techStack: string[];
  level: "intern" | "junior" | "mid" | "senior";
  mode: "behavioral" | "technical" | "mixed";
  status: "in_progress" | "completed";
  questions: string[];
  answers: SessionAnswer[];
  averageScore?: number;
  startedAt: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const answerSchema = new mongoose.Schema({
  question: { type: String, required: true, maxlength: 1200 },
  answerText: { type: String, required: true, maxlength: 6000 },
  durationSeconds: { type: Number, min: 0, max: 7200 },
  feedback: { type: mongoose.Schema.Types.Mixed, required: true },
  weakTopics: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const sessionSchema = new mongoose.Schema<InterviewSessionDocument>({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  role: { type: String, required: true, maxlength: 100 },
  techStack: { type: [String], default: [] },
  level: { type: String, required: true, enum: ["intern", "junior", "mid", "senior"] },
  mode: { type: String, required: true, enum: ["behavioral", "technical", "mixed"] },
  status: { type: String, enum: ["in_progress", "completed"], default: "in_progress" },
  questions: { type: [String], default: [] },
  answers: { type: [answerSchema], default: [] },
  averageScore: { type: Number, min: 1, max: 5 },
  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
}, { timestamps: true });

sessionSchema.index({ userId: 1, createdAt: -1 });
export const InterviewSession: Model<InterviewSessionDocument> = (mongoose.models.InterviewSession as Model<InterviewSessionDocument> | undefined) ?? mongoose.model<InterviewSessionDocument>("InterviewSession", sessionSchema);
