import { z } from "zod";

export const interviewSetupSchema = z.object({
  role: z.string().trim().min(2).max(100),
  techStack: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
  level: z.enum(["intern", "junior", "mid", "senior"]),
  mode: z.enum(["behavioral", "technical", "mixed"]),
  questionCount: z.number().int().min(1).max(10),
  jobDescription: z.string().max(12000).optional(),
  resumeText: z.string().max(25000).optional(),
});

export const answerSchema = z.object({
  question: z.string().min(3).max(1200),
  answer: z.string().trim().min(10).max(6000),
});

export const feedbackSchema = z.object({
  scores: z.object({ correctness: z.number().min(1).max(5), clarity: z.number().min(1).max(5), depth: z.number().min(1).max(5) }),
  strengths: z.array(z.string()).min(1).max(4),
  improvements: z.array(z.string()).min(1).max(4),
  improvedAnswer: z.string().min(10).max(4000),
  weakTopics: z.array(z.string()).max(5).default([]),
  starReview: z.object({ situation: z.boolean(), task: z.boolean(), action: z.boolean(), result: z.boolean(), summary: z.string().min(5).max(400) }).optional(),
});

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(10).max(128),
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
});

export type InterviewSetup = z.infer<typeof interviewSetupSchema>;
export type Feedback = z.infer<typeof feedbackSchema>;
