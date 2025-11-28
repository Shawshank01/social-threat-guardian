/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        "stg-bg": "#1e293b", // Warmer dark slate instead of near-black
        "stg-panel": "#334155", // Lighter panel for better contrast
        "stg-accent": "#3da1ff",
        "stg-accent-soft": "#7f53ff",
        "stg-alert": "#ff6b6b"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui"],
      },
      boxShadow: {
        soft: "0 20px 45px rgba(30, 41, 59, 0.3)"
      }
    },
  },
  plugins: [],
};
