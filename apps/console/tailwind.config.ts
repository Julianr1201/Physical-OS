import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: 'var(--paper)',
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        line: 'var(--line)',
        brass: 'var(--brass)',
        pine: 'var(--pine)',
        clay: 'var(--clay)',
      },
      fontFamily: {
        sans: ['"Source Sans 3"', 'sans-serif'],
        serif: ['Manrope', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
