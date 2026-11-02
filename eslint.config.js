import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/.next/**', '**/next-env.d.ts', '**/dist/**'] },
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      'data/**',
      'coverage/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['scripts/**/*.mjs', 'apps/console/postcss.config.js'],
    languageOptions: {
      globals: { process: 'readonly', module: 'readonly' },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
);
