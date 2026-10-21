import { Router } from "express";
import multer from "multer";
import { PDFParse } from "pdf-parse";
import { requireAuth } from "../middleware/auth.js";

export const resumeRouter = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => callback(null, file.mimetype === "application/pdf" && file.originalname.toLowerCase().endsWith(".pdf")),
});

resumeRouter.post("/", requireAuth, upload.single("resume"), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ code: "PDF_REQUIRED", message: "Choose a PDF resume under 4 MB." });
  if (file.buffer.subarray(0, 5).toString() !== "%PDF-") return res.status(400).json({ code: "INVALID_PDF", message: "That file does not appear to be a valid PDF." });

  const parser = new PDFParse({ data: file.buffer });
  try {
    const parsed = await parser.getText();
    const resumeText = parsed.text.replace(/\0/g, " ").replace(/[ \t]+/g, " ").trim().slice(0, 25000);
    if (resumeText.length < 80) return res.status(422).json({ code: "NO_RESUME_TEXT", message: "We couldn't extract enough text. Try an exported, text-based PDF instead of a scanned image." });
    res.json({ filename: file.originalname, resumeText, characters: resumeText.length, persisted: false });
  } catch (error) {
    console.error("Resume PDF extraction failed", error instanceof Error ? error.message : "Unknown error");
    res.status(422).json({ code: "PDF_READ_FAILED", message: "We couldn't read that PDF. Try exporting your resume to PDF again." });
  } finally {
    await parser.destroy();
  }
});
