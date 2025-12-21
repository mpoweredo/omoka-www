// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  site: 'https://omoka.dev',
  integrations: [sitemap()],
  // Enable server rendering for API routes
  output: 'server',
  adapter: node({
    mode: 'standalone',
  }),
});
