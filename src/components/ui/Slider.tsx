import type { InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type SliderProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  unit?: string
  showValue?: boolean
}

export function Slider({ label, unit, showValue = true, className, ...props }: SliderProps) {
  const id = props.id ?? `slider-${props.name ?? crypto.randomUUID?.() ?? Date.now()}`

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <div className='flex items-center justify-between'>
          <label htmlFor={id} className='text-xs font-semibold uppercase tracking-wide text-muted'>
            {label}
          </label>
          {showValue && props.value !== undefined && (
            <span className='text-xs font-mono text-accent'>
              {Number(props.value).toFixed(0)}{unit ?? ''}
            </span>
          )}
        </div>
      )}
      <input
        id={id}
        type='range'
        className={cn(
          'h-2 w-full cursor-pointer appearance-none rounded-full bg-panel-strong accent-accent',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
        )}
        aria-valuenow={Number(props.value ?? 0)}
        aria-valuemin={Number(props.min ?? 0)}
        aria-valuemax={Number(props.max ?? 100)}
        {...props}
      />
    </div>
  )
}
