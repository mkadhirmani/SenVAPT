/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        heading: ['Satoshi', 'Inter', 'system-ui', 'sans-serif'],
        brand: ['Satoshi', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        sennovate: {
          blue: {
            DEFAULT: '#006FE3',
            70: '#4D9AEC',
            50: '#80B7F1',
            30: '#B3D4F7',
            10: '#E6F1FC',
          },
          dark: {
            DEFAULT: '#001B41',
            deep: '#001127',
            card: '#001E4B',
            elevated: '#002863',
            border: '#0A3778',
            70: '#4D5F7A',
            50: '#808D9F',
            30: '#B3BAC6',
            10: '#E6E8EC',
          },
          green: {
            DEFAULT: '#299346',
            light: '#EAF7EE',
          },
          purple: {
            DEFAULT: '#3C2C86',
            light: '#EFEBFB',
          },
          amber: {
            DEFAULT: '#B9623C',
            light: '#FDF2EC',
          }
        }
      }
    },
  },
  plugins: [],
}
