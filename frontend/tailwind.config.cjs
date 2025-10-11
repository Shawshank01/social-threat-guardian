/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        "stg-bg": "#05070f",
        "stg-panel": "#0f1a2a",
        "stg-accent": "#3da1ff",
        "stg-accent-soft": "#7f53ff",
        "stg-alert": "#ff6b6b"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui"],
      },
      boxShadow: {
        soft: "0 20px 45px rgba(5, 14, 35, 0.4)"
      }
    },
  },
  plugins: [],
};
