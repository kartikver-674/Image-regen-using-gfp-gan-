import type { ReactNode } from 'react'
import { ScanLine } from './ScanLine'

/** The signature: a framed print with corner brackets + an optional scan line. */
export function ScannerFrame({
  children,
  scan,
  className = '',
}: {
  children: ReactNode
  scan?: 'idle' | 'active'
  className?: string
}) {
  return (
    <div className={`frame ${className}`}>
      {children}
      <span className="frame-corner tl" aria-hidden="true" />
      <span className="frame-corner tr" aria-hidden="true" />
      <span className="frame-corner bl" aria-hidden="true" />
      <span className="frame-corner br" aria-hidden="true" />
      {scan && <ScanLine active={scan === 'active'} />}
    </div>
  )
}
