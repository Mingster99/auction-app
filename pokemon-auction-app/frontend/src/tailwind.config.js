/** @type {import('tailwindcss').Config} */
// ============================================================
// TAILWIND CONFIG FILE
// ============================================================
// This tells Tailwind:
// 1. WHERE to look for class names (content)
// 2. HOW to extend the default design system (theme)
// 3. WHAT plugins to use
//
// Tailwind scans your files and only includes CSS for
// classes you actually use - keeps the file small!
// ============================================================

module.exports = {
  // content: tells Tailwind which files to scan for class names
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    // Scans ALL .js, .jsx, .ts, .tsx files in src/ folder
  ],

  theme: {
    extend: {
      // Add custom colors to use alongside Tailwind defaults
      colors: {
        primary: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
        },
      },

      // Custom animations
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },

      // Keyframe definitions for custom animations
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },

      // Custom font families
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },

      // Custom border radius sizes
      borderRadius: {
        '4xl': '2rem',
      },

      // Custom box shadows
      boxShadow: {
        'glow-violet': '0 0 30px rgba(139, 92, 246, 0.3)',
        'glow-blue': '0 0 30px rgba(59, 130, 246, 0.3)',
      },
    },
  },

  plugins: [],
};
