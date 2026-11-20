import { z } from "zod";
import { LEVELS, DIFFICULTIES } from "./config";

// Validates both the seed files and admin edits, so the same rules apply to
// content however it gets into the database.

export const sectionSchema = z.object({ heading: z.string().trim().min(1).max(120), body: z.string().trim().min(1).max(1500) });
export const conceptSchema = z.object({ term: z.string().trim().min(1).max(80), definition: z.string().trim().min(1).max(400) });
export const exampleSchema = z.object({ title: z.string().trim().min(1).max(120), body: z.string().trim().min(1).max(1500) });

export const moduleInput = z.object({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes"),
  level: z.enum(LEVELS as [string, ...string[]]),
  title: z.string().trim().min(2).max(120),
  summary: z.string().trim().max(400).default(""),
  minutes: z.number().int().min(1).max(120).default(5),
  objectives: z.array(z.string().trim().min(1).max(200)).max(8).default([]),
  sections: z.array(sectionSchema).min(1).max(12),
  concepts: z.array(conceptSchema).max(12).default([]),
  example: exampleSchema.nullable().optional(),
});

export const questionInput = z
  .object({
    difficulty: z.enum(DIFFICULTIES as [string, ...string[]]),
    prompt: z.string().trim().min(5).max(500),
    options: z.array(z.string().trim().min(1).max(200)).length(4),
    answer: z.number().int().min(0).max(3),
    explanation: z.string().trim().max(800).default(""),
  })
  .refine((q) => new Set(q.options.map((o) => o.toLowerCase())).size === 4, { message: "Options must be different" });

export const categoryFile = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().min(2).max(80),
  tagline: z.string().max(140).default(""),
  icon: z.string().max(40).default("BookOpen"),
  order: z.number().int().default(0),
  modules: z.array(moduleInput).min(1),
  questions: z.array(z.intersection(z.object({ module: z.string() }), questionInput)).min(1),
});

export type CategoryFile = z.infer<typeof categoryFile>;
