/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cue: {
          // Teal (admin / results)
          sidebar:      '#042F2E',
          dark:         '#134E4A',
          teal:         '#0F766E',
          mid:          '#0D9488',
          light:        '#5EEAD4',
          pale:         '#CCFBF1',
          bg:           '#F0FDFA',
          // Purple (landing / interview)
          purple:       '#7C3AED',
          'purple-mid': '#A855F7',
          'purple-dark':'#5B21B6',
          'purple-light':'#DDD6FE',
          'purple-bg':  '#F5F3FF',
          // Orange / pink (CTA / mic)
          orange:       '#F97316',
          'orange-dark':'#EA580C',
          'orange-light':'#FED7AA',
          pink:         '#EC4899',
          // Legacy aliases
          violet:       '#7C3AED',
          'violet-light':'#DDD6FE',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'mic-ring': {
          '0%':   { transform: 'scale(1)',   opacity: '0.55' },
          '100%': { transform: 'scale(2.8)', opacity: '0'    },
        },
        'fade-up': {
          '0%':   { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)'    },
        },
        'shimmer': {
          '0%':   { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0'  },
        },
      },
      animation: {
        'mic-ring':         'mic-ring 2.2s cubic-bezier(0.2,0.6,0.35,1) infinite',
        'mic-ring-d1':      'mic-ring 2.2s cubic-bezier(0.2,0.6,0.35,1) 0.73s infinite',
        'mic-ring-d2':      'mic-ring 2.2s cubic-bezier(0.2,0.6,0.35,1) 1.46s infinite',
        'fade-up':          'fade-up 0.45s ease-out both',
        'shimmer':          'shimmer 1.6s linear infinite',
      },
    },
  },
  plugins: [],
};
