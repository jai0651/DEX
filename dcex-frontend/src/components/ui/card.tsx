import { forwardRef, HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-2xl bg-card border border-white/5 shadow-card',
          className
        )}
        {...props}
      />
    )
  }
)
Card.displayName = 'Card'

const CardHeader = forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('px-4 py-3 border-b border-white/5', className)}
        {...props}
      />
    )
  }
)
CardHeader.displayName = 'CardHeader'

const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => {
    return (
      <h3
        ref={ref}
        className={cn('font-semibold text-foreground', className)}
        {...props}
      />
    )
  }
)
CardTitle.displayName = 'CardTitle'

const CardContent = forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => {
    return <div ref={ref} className={cn('p-4', className)} {...props} />
  }
)
CardContent.displayName = 'CardContent'

export { Card, CardHeader, CardTitle, CardContent }
