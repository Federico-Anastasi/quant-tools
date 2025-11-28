/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        void: {
          900: '#0b0e11',
          800: '#15191e',
          700: '#1e232b',
          600: '#2a2e39',
          500: '#454d5f',
        },
        neon: {
          cyan: '#00f0ff',
          red: '#ff0055',
          purple: '#a855f7',
          amber: '#fbbf24',
          green: '#00ff00',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
