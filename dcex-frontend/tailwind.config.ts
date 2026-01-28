import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
          hover: 'hsl(var(--card-hover))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        buy: {
          DEFAULT: '#22c55e',
          foreground: '#ffffff',
          muted: 'rgba(34, 197, 94, 0.15)',
        },
        sell: {
          DEFAULT: '#ef4444',
          foreground: '#ffffff',
          muted: 'rgba(239, 68, 68, 0.15)',
        },
        pink: {
          DEFAULT: '#fc72ff',
          muted: 'rgba(252, 114, 255, 0.15)',
        },
      },
      borderRadius: {
        '2xl': 'calc(var(--radius) + 4px)',
        xl: 'var(--radius)',
        lg: 'calc(var(--radius) - 4px)',
        md: 'calc(var(--radius) - 6px)',
        sm: 'calc(var(--radius) - 8px)',
      },
      boxShadow: {
        glow: '0 0 20px rgba(252, 114, 255, 0.15)',
        'glow-strong': '0 0 30px rgba(252, 114, 255, 0.25)',
        card: '0 4px 12px rgba(0, 0, 0, 0.5)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-pink': 'linear-gradient(135deg, #fc72ff 0%, #f050ff 100%)',
        'gradient-buy': 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
        'gradient-sell': 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
      },
    },
  },
  plugins: [],
}
export default config
