import { defineConfig } from 'eslint/config';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import prettier from 'eslint-config-prettier/flat';

export default defineConfig([
  ...nextCoreWebVitals,
  prettier,
  {
    ignores: ['.netlify/**'],
    rules: {
      'react/no-unescaped-entities': 'off',
    },
  },
]);
