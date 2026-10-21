import mongoose, { type Model } from "mongoose";

export interface UserDocument { name: string; email: string; passwordHash: string; revisedTopics: string[]; createdAt: Date }

const userSchema = new mongoose.Schema<UserDocument>({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  revisedTopics: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: false });

export const User: Model<UserDocument> = (mongoose.models.User as Model<UserDocument> | undefined) ?? mongoose.model<UserDocument>("User", userSchema);
