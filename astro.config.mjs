import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import vercel from '@astrojs/vercel';
import auth from 'auth-astro';

export default defineConfig({
  site: 'https://jingyuan-dev-spda.vercel.app',
  output: 'server',
  adapter: vercel(),
  integrations: [mdx(), auth()],
});
