/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#FFFFFF',
        card: '#FFFFFF',
        primary: '#1A1A1A',
        'text-main': '#1A1A1A',
        'text-gray': '#8A8A8A',
        'border-color': '#F0F0F0',
        'secondary-bg': '#F8F8F8',
      },
      borderRadius: {
        'card': '14px',
        'button': '14px',
        'input': '10px',
        'tag': '6px',
      },
      boxShadow: {
        'card': '0 1px 4px rgba(0,0,0,0.03)',
        'float': '0 8px 24px rgba(0,0,0,0.08)',
      }
    },
  },
  plugins: [],
}