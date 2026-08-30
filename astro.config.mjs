import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://wojusensei.github.io',
  trailingSlash: 'ignore',
  build: {
    inlineStylesheets: 'auto',
  },
});
