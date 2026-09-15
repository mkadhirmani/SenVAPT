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
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        heading: ['Satoshi', '"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        brand: ['Satoshi', '"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        'card-executive': '0 2px 8px -1px rgba(0, 27, 65, 0.05), 0 1px 3px 0 rgba(0, 27, 65, 0.03), 0 0 0 1px rgba(0, 27, 65, 0.06)',
        'card-executive-hover': '0 12px 28px -4px rgba(0, 27, 65, 0.09), 0 4px 12px -2px rgba(0, 111, 227, 0.08), 0 0 0 1px rgba(0, 111, 227, 0.25)',
        'card-flat': '0 0 0 1px rgba(226, 232, 240, 0.9), 0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        'glow-blue': '0 0 24px -2px rgba(0, 111, 227, 0.35)',
        'glow-red': '0 0 24px -2px rgba(220, 38, 38, 0.3)',
      },
      colors: {
        sennovate: {
          blue: {
            DEFAULT: '#006FE3',
            dark: '#005BBF',
            70: '#4D9AEC',
            50: '#80B7F1',
            30: '#B3D4F7',
            10: '#E6F1FC',
            5: '#F2F8FE',
          },
          dark: {
            DEFAULT: '#001B41',
            deep: '#001127',
            surface: '#001633',
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
            border: '#A7E3B6',
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
