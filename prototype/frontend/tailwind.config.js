/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0a0e14',
        surface: '#1a1f29',
        'surface-elevated': '#252b38',
        primary: '#58a6ff',
        'primary-light': '#79b8ff',
        'primary-dark': '#388bfd',
        secondary: '#8b949e',
        tertiary: '#57606a',
        success: '#3fb950',
        warning: '#d29922',
        error: '#f85149',
        info: '#a371f7',
      },
      fontFamily: {
        // Font stack: Inter Tight (Google Fonts loaded) > system condensed fonts > system defaults
        // 'DIN Next' and 'Roboto Condensed' are listed for future compatibility if project licenses them
        header: ['Inter Tight', 'DIN Next', 'Roboto Condensed', 'sans-serif'],
        body: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 300ms linear',
        'fade-in-delayed': 'fadeIn 300ms linear 100ms backwards',
        'error-slide-in': 'errorSlideIn 200ms ease-out',
        'slide-in-right': 'slideInRight 300ms ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        errorSlideIn: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
}
