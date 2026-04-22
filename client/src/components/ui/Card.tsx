import type { PropsWithChildren, ReactNode } from 'react'

type CardProps = PropsWithChildren<{
  title?: string
  subtitle?: string
  right?: ReactNode
  className?: string
}>

export function Card({ title, subtitle, right, className = '', children }: CardProps) {
  return (
    <section className={`rounded-2xl border border-gray-100 bg-white p-6 shadow-lg ${className}`}>
      {(title || subtitle || right) && (
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title && <h3 className="text-base font-semibold text-gray-900">{title}</h3>}
            {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
          </div>
          {right}
        </header>
      )}
      {children}
    </section>
  )
}
