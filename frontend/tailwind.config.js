/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        cw: '#3b82f6',
        pw: '#f59e0b',
        event: '#10b981',
        test: '#ef4444',
      },
    },
  },
  plugins: [],
}
