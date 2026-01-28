import { forwardRef, ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-glow hover:shadow-glow-strong',
        destructive: 'bg-sell text-white hover:bg-sell/90',
        outline: 'border border-border bg-transparent hover:bg-card-hover hover:border-muted-foreground/30',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-card-hover',
        link: 'text-primary underline-offset-4 hover:underline',
        buy: 'bg-gradient-buy text-white hover:opacity-90 shadow-lg hover:shadow-xl',
        sell: 'bg-gradient-sell text-white hover:opacity-90 shadow-lg hover:shadow-xl',
        pink: 'bg-pink/20 text-pink hover:bg-pink/30 border border-pink/30',
      },
      size: {
        default: 'h-11 px-5 py-2',
        sm: 'h-9 rounded-lg px-3',
        lg: 'h-12 rounded-xl px-8 text-base',
        xl: 'h-14 rounded-2xl px-10 text-lg',
        icon: 'h-10 w-10 rounded-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
