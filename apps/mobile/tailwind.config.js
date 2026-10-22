/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: {
          main: "#0B0F19",
          surface: "#161F30",
          surfaceElevated: "#1E293B",
        },
        subtitles: {
          activeWord: "#38BDF8",
          wordTapped: "#FACC15",
        },
        tinder: {
          again: "#EF4444",
          hard: "#F59E0B",
          good: "#10B981",
          easy: "#38BDF8",
        },
      },
    },
  },
  plugins: [],
};
