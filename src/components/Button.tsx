import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'quiet'
  wide?: boolean
}

export function Button({ children, variant = 'primary', wide, className = '', ...props }: Props) {
  return <button className={`button button--${variant} ${wide ? 'button--wide' : ''} ${className}`} {...props}>{children}</button>
}
