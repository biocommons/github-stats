import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: ['./app/**/*.{vue,ts}'],
  theme: {
    extend: {
      colors: {
        'bc-teal': {
          200: '#99ede5',
          300: '#26d4be',
          400: '#00bda4',
          500: '#009987',
          600: '#007a6c',
        },
        'bc-indigo': {
          200: '#a5b4fc',
          300: '#818cf8',
          400: '#5d6cc0',
          500: '#4051b5',
          600: '#303fa1',
        },
      },
      fontFamily: {
        sans: ['Lato', 'system-ui', 'sans-serif'],
      },
    },
  },
} satisfies Config
