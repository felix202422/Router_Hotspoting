/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Design language (§14, refreshed to the green Wi-Fi kit): mint page
        // surfaces, forest-green panels, leaf-green accents, citrus CTAs.
        // Status semantics stay green / amber / red (NFR-02).
        mint: {
          50: '#F6FBF1',
          100: '#EAF7E1', // page background
          200: '#DDEFD0',
          300: '#CBE8B4',
        },
        forest: {
          950: '#0E1F10', // overlays
          900: '#163019', // headers, sidebar, hero panels
          800: '#1E4223', // hover
          700: '#27552E', // borders on dark
          600: '#2F6B3A',
        },
        leaf: {
          50: '#F1FAEA',
          100: '#DDF3CD',
          200: '#BCE8A1',
          500: '#2E9E44', // focus borders (≥3:1 on white)
          600: '#2E7D32', // links, active states (≥4.5:1 on white)
          700: '#1B5E20',
          800: '#14532D',
        },
        citrus: {
          50: '#FFF7E8',
          100: '#FFECC6',
          200: '#FDD68A',
          500: '#F5A623', // primary CTA fill (dark text on top, ≥4.5:1)
          600: '#E8930A', // CTA hover
          700: '#B45309', // orange text on white (≥4.5:1)
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(15 23 42 / 0.06), 0 1px 3px 0 rgb(15 23 42 / 0.08)',
        drawer: '-8px 0 24px 0 rgb(15 23 42 / 0.12)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'slide-up': 'slide-up 200ms ease-out',
      },
    },
  },
  plugins: [],
};
