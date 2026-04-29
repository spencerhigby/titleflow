/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#102033",
        mint: "#38b98f",
        gold: "#f5b84b",
        coral: "#ef6f61",
      },
      boxShadow: {
        panel: "0 18px 45px rgba(16, 32, 51, 0.10)",
      },
    },
  },
  plugins: [],
};
