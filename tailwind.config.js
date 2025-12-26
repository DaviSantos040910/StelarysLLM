/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        'space-bg': '#0b0e14', // Void
        'space-card': '#1e1b4b', // Indigo Deep (darker/different from void)
        'nebula': '#6366f1', // Indigo 500 (Vibrant)

        // Keeping previous aliases for backward compatibility or gradients
        background: {
          DEFAULT: '#0b0e14',
          deep: '#1e1b4b',
        },
        primary: {
          DEFAULT: '#6366f1',
          foreground: '#ffffff',
        },
        secondary: {
          DEFAULT: '#d946ef',
          foreground: '#ffffff',
        },
        accent: {
          cyan: '#06b6d4',
          purple: '#8b5cf6',
        },
        text: {
          DEFAULT: '#ffffff',
          muted: '#94a3b8',
        },
        card: {
          DEFAULT: 'rgba(30, 27, 75, 0.9)', // Matching space-card approx
        },
      },
    },
  },
  plugins: [],
}
