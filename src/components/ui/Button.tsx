import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline'
type Size = 'sm' | 'md' | 'lg'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
}

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
}

const baseStyles =
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base disabled:pointer-events-none disabled:opacity-60'

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-white shadow-glow hover:bg-accent-strong',
  secondary: 'bg-panel-strong text-text hover:bg-panel',
  ghost: 'bg-transparent text-muted hover:text-text hover:bg-panel',
  outline: 'border border-border text-text hover:bg-panel',
}

export function Button({ variant = 'primary', size = 'md', className, ...props }: ButtonProps) {
  return (
    <button className={cn(baseStyles, variants[variant], sizeClasses[size], className)} {...props} />
  )
}
