import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

// Full-screen overlay for the expanded chart view. Esc or backdrop closes;
// focus moves to the close button on open and returns to the opener after.
export default function ChartModal({ title, subtitle, onClose, children }) {
  const closeRef = useRef(null)

  useEffect(() => {
    const opener = document.activeElement
    closeRef.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      opener?.focus?.()
    }
  }, [onClose])

  return createPortal(
    <div className="chart-modal-overlay" onClick={onClose}>
      <div
        className="chart-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${title} — expanded chart`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="chart-modal-head">
          <div>
            <h3>{title}</h3>
            {subtitle && <p className="chart-modal-sub">{subtitle}</p>}
          </div>
          <button ref={closeRef} className="chart-modal-close" onClick={onClose} aria-label="Close expanded chart">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
