import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    // Core fields
    title: z.string(),
    description: z.string(),
    author: z.string(),

    // Date fields
    publishedAt: z.coerce.date(),

    // Content metadata
    readingTime: z.string().optional(),
    tags: z.array(z.string()).default([]),

    // Image
    coverImage: z.string().optional(),

    // SEO fields
    canonical: z.string().optional(),
    seo: z
      .object({
        ogUrl: z.string().optional(),
        ogType: z.string().optional(),
        twitterCard: z.string().optional(),
      })
      .optional(),

    // JSON-LD Schema.org structured data
    schema: z.record(z.any()).optional(),
  }),
});

const legal = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    lastUpdated: z.coerce.date(),
  }),
});

export const collections = {
  blog,
  legal,
};
