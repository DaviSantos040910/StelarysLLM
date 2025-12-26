/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: '#0b0e14', // Void
          deep: '#1e1b4b', // Indigo Deep
        },
        primary: {
          DEFAULT: '#6366f1', // Indigo 500
          foreground: '#ffffff',
        },
        secondary: {
          DEFAULT: '#d946ef', // Fuchsia 500 (Magenta-ish)
          foreground: '#ffffff',
        },
        accent: {
          cyan: '#06b6d4', // Cyan 500
          purple: '#8b5cf6', // Violet 500 (Electric Purple)
        },
        text: {
          DEFAULT: '#ffffff',
          muted: '#94a3b8', // Slate 400 (Stellar Gray)
        },
        card: {
          DEFAULT: 'rgba(15, 23, 42, 0.9)', // Slate 900 / 90%
        },
      },
    },
  },
  plugins: [],
}
