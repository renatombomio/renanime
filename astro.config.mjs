// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  integrations: [react()],

  vite: {
    plugins: [tailwindcss()],
    server: {
      proxy: {
        '/api/tmdb': {
          target: 'https://api.themoviedb.org',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/api\/tmdb/, '/3'),
          headers: process.env.TMDB_READ_ACCESS_TOKEN
            ? { Authorization: `Bearer ${process.env.TMDB_READ_ACCESS_TOKEN}` }
            : undefined,
        },
      },
    },
  },
});
