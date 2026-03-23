/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        darkBg: '#0B1120',      // Ton mode sombre profond
        glassBg: '#1E293B',     // L'effet verre dépoli
        neonGreen: '#10B981',   // Statut Conforme
        neonOrange: '#F59E0B',  // Statut Vigilance
        neonRed: '#EF4444',     // Statut Critique
      }
    },
  },
  plugins: [],
}