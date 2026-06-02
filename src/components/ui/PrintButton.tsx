'use client'

import { Button } from './Button'

interface PrintButtonProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  className?: string
  children?: React.ReactNode
}

export function PrintButton({
  variant = 'secondary',
  size = 'md',
  className,
  children = 'Imprimir Reporte'
}: PrintButtonProps) {
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={() => {
        if (typeof window !== 'undefined') {
          window.print()
        }
      }}
    >
      {children}
    </Button>
  )
}
