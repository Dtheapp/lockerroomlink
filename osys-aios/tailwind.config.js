/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        osys: {
          purple: '#8b5cf6',
          gold: '#f59e0b',
          dark: '#0f0f0f',
          darker: '#0a0a0a',
        }
      }
    },
  },
  plugins: [],
};
