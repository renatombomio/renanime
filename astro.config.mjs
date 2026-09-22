// @ts-check
import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    integrations: [react()],

    vite: {
      plugins: [tailwindcss()],
      server: {
        proxy: {
          '/api/tmdb': {
            target: 'https://api.themoviedb.org',
            changeOrigin: true,
            secure: true,
            rewrite: (path) => path.replace(/^\\/api\\/tmdb/, '/3'),
            headers: env.TMDB_READ_ACCESS_TOKEN
              ? { Authorization: `Bearer ${env.TMDB_READ_ACCESS_TOKEN}` }
              : undefined,
          },
        },
      },
    },
  };
});
