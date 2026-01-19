/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Spy Terminal Theme
        'void': '#0a0a0f',
        'void-light': '#12121a',
        'void-lighter': '#1a1a24',
        // Mainframe (cyan - calm, encouraging)
        'mainframe': {
          DEFAULT: '#00ffcc',
          dark: '#00cc99',
          light: '#66ffdd',
          glow: 'rgba(0, 255, 204, 0.3)',
        },
        // Dr. Glitch (amber/orange - chaotic)
        'glitch': {
          DEFAULT: '#ffaa00',
          dark: '#cc8800',
          light: '#ffcc44',
          glow: 'rgba(255, 170, 0, 0.3)',
        },
        // Status colors
        'success': {
          DEFAULT: '#44ff88',
          dark: '#22cc66',
          glow: 'rgba(68, 255, 136, 0.3)',
        },
        'danger': {
          DEFAULT: '#ff4444',
          dark: '#cc2222',
          glow: 'rgba(255, 68, 68, 0.3)',
        },
      },
      fontFamily: {
        'mono': ['JetBrains Mono', 'Fira Code', 'monospace'],
        'display': ['Orbitron', 'sans-serif'],
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'glitch': 'glitch 0.5s ease-in-out infinite',
        'scan': 'scan 2s linear infinite',
        'typewriter': 'typewriter 0.05s steps(1) forwards',
        'blink': 'blink 1s step-end infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: '1', filter: 'brightness(1)' },
          '50%': { opacity: '0.8', filter: 'brightness(1.2)' },
        },
        'glitch': {
          '0%, 100%': { transform: 'translate(0)' },
          '20%': { transform: 'translate(-2px, 2px)' },
          '40%': { transform: 'translate(-2px, -2px)' },
          '60%': { transform: 'translate(2px, 2px)' },
          '80%': { transform: 'translate(2px, -2px)' },
        },
        'scan': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        'blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
      },
      boxShadow: {
        'mainframe': '0 0 20px rgba(0, 255, 204, 0.3), 0 0 40px rgba(0, 255, 204, 0.1)',
        'glitch': '0 0 20px rgba(255, 170, 0, 0.3), 0 0 40px rgba(255, 170, 0, 0.1)',
        'success': '0 0 20px rgba(68, 255, 136, 0.3)',
        'danger': '0 0 20px rgba(255, 68, 68, 0.3)',
      },
    },
  },
  plugins: [],
}


