/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: { dark: '#0F0F12', light: '#FAF6EF' },
        amber: { DEFAULT: '#E8A33D' },
        coral: '#E8674C',
        'ok-green': '#4CAF7D',
      },
      fontFamily: {
        serif: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: { card: '18px' },
    },
  },
  plugins: [],
}
