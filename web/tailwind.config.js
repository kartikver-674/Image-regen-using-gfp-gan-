/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Cool "space" lit by warm light — luminance layers, not one flat fill.
        void: '#0B0B10',
        surface: '#14141C',
        raised: '#1B1B25',
        canvas: { dark: '#0B0B10', light: '#FAF6EF' }, // kept: legacy body classes
        amber: { DEFAULT: '#E8A33D', glow: '#FFCE7A' },
        coral: '#E8674C',
        iris: '#8B6FE0', // cool end of the recovered-light spectrum
        'ok-green': '#4CAF7D',
      },
      fontFamily: {
        serif: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: { card: '18px', frame: '22px' },
      boxShadow: {
        // Elevation that reads as depth against the dark canvas.
        lift: '0 24px 60px -28px rgba(0, 0, 0, 0.75)',
        hero: '0 40px 110px -32px rgba(0, 0, 0, 0.8)',
        'amber-glow': '0 0 0 1px rgba(232,163,61,0.25), 0 14px 40px -12px rgba(232,163,61,0.35)',
      },
      letterSpacing: { label: '0.22em' },
      transitionTimingFunction: {
        // One easing across the app so motion feels like one hand.
        resolve: 'cubic-bezier(0.2, 0.7, 0.2, 1)',
      },
    },
  },
  plugins: [],
}
