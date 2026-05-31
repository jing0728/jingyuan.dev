import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const learning = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/learning' }),
  schema: z.object({
    title: z.string(),
    date: z.date(),
    tags: z.array(z.string()).default([]),
    summary: z.string().optional(),
    private: z.boolean().default(false),
  }),
});

const projects = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    date: z.date(),
    repo: z.string().url().optional(),
    demo: z.string().url().optional(),
    tech: z.array(z.string()).default([]),
    summary: z.string().optional(),
    private: z.boolean().default(false),
  }),
});

const experience = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/experience' }),
  schema: z.object({
    title: z.string(),
    company: z.string(),
    location: z.string().optional(),
    startDate: z.date(),
    endDate: z.date().optional(),
    tech: z.array(z.string()).default([]),
    summary: z.string().optional(),
    private: z.boolean().default(false),
  }),
});

const leetcode = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/leetcode' }),
  schema: z.object({
    problemId: z.number(),
    title: z.string(),
    date: z.date(),
    difficulty: z.enum(['Easy', 'Medium', 'Hard']),
    tags: z.array(z.string()).default([]),
    private: z.boolean().default(false),
  }),
});

export const collections = { learning, projects, experience, leetcode };
