import type { Config } from 'tailwindcss'

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Noto Sans KR', 'sans-serif'],
        pixel: ['Noto Sans KR', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
