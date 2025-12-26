/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        'space-dark': '#020617', // Slate 950
        'space-light': '#1e293b', // Slate 800
        'starlight': '#f8fafc', // Slate 50
        'cosmic-purple': '#818cf8', // Indigo 400
        'nebula-pink': '#f472b6', // Pink 400

        // Aliases for compatibility with previous plan / existing components
        'space-bg': '#020617', // Mapping to new dark
        'space-card': '#1e293b', // Mapping to new light
        'nebula': '#818cf8', // Mapping to cosmic purple for primary actions

        background: {
          DEFAULT: '#020617',
          deep: '#1e293b',
        },
        primary: {
          DEFAULT: '#818cf8',
          foreground: '#ffffff',
        },
        secondary: {
          DEFAULT: '#f472b6',
          foreground: '#ffffff',
        },
        accent: {
          cyan: '#06b6d4',
          purple: '#8b5cf6',
        },
        text: {
          DEFAULT: '#f8fafc',
          muted: '#94a3b8',
        },
        card: {
          DEFAULT: 'rgba(30, 41, 59, 0.9)', // Matching space-light approx
        },
      },
    },
  },
  plugins: [],
}
