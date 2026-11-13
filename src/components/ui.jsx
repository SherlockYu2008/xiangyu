import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import Icon from './Icon'

/* ---------------- Avatar ---------------- */

const PALETTE = [
  ['#6d6af9', '#a78bfa'],
  ['#22b8a0', '#6ee7d7'],
  ['#f0779a', '#fbb6ce'],
  ['#4f8df7', '#8ec5ff'],
  ['#f5a623', '#ffd08a'],
  ['#8b5cf6', '#d8b4fe'],
  ['#0ea5a4', '#67e8f9'],
  ['#ef6c6c', '#fca5a5'],
]

function hashOf(str = '') {
  let h = 0
  for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function Avatar({ name = '?', seed, size = 40, online = false, ring = false, className = '' }) {
  const [a, b] = PALETTE[hashOf(seed || name) % PALETTE.length]
  const ch = [...name][0] || '?'
  return (
    <span
      className={`avatar ${ring ? 'avatar--ring' : ''} ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.42),
        background: `linear-gradient(135deg, ${a}, ${b})`,
      }}
      title={name}
    >
      {ch}
      {online && <i className="avatar__dot" style={{ width: Math.max(8, size * 0.22), height: Math.max(8, size * 0.22) }} />}
    </span>
  )
}

/* ---------------- Tag ---------------- */

export function Tag({ children, tone = 'default', active = false, onClick, className = '' }) {
  const Comp = onClick ? 'button' : 'span'
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      className={`tag tag--${tone} ${active ? 'is-active' : ''} ${onClick ? 'tag--btn' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </Comp>
  )
}

/* ---------------- ScoreRing ---------------- */

export function ScoreRing({ score = 0, size = 54, label = '同频' }) {
  const r = (size - 6) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, score)) / 100
  const color = score >= 75 ? '#5b55f0' : score >= 55 ? '#8b5cf6' : '#b9b9d6'
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#ececf6" strokeWidth="4" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ring__txt" style={{ fontSize: Math.round(size * 0.3) }}>
        <b>{score}</b>
        <span>{label}</span>
      </div>
    </div>
  )
}

/* ---------------- Progress ---------------- */

export function Progress({ value = 0, max = 1, tone = 'brand' }) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100))
  return (
    <span className={`bar bar--${tone}`}>
      <i style={{ width: `${pct}%` }} />
    </span>
  )
}

/* ---------------- Switch ---------------- */

export function Switch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`switch ${checked ? 'is-on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <i />
    </button>
  )
}

/* ---------------- Empty ---------------- */

export function Empty({ title = '这还没有内容', desc, action, icon = 'sparkles' }) {
  return (
    <div className="empty">
      <div className="empty__ico">
        <Icon name={icon} size={26} />
      </div>
      <h4>{title}</h4>
      {desc && <p>{desc}</p>}
      {action}
    </div>
  )
}

/* ---------------- Modal ---------------- */

export function Modal({ open, onClose, title, subtitle, children, footer, width = 560 }) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="modal-mask" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="modal" style={{ maxWidth: width }} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal__head">
          <div>
            <h3>{title}</h3>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭">
            <Icon name="x" size={18} />
          </button>
        </header>
        <div className="modal__body">{children}</div>
        {footer && <footer className="modal__foot">{footer}</footer>}
      </div>
    </div>
  )
}

/* ---------------- Toast ---------------- */

const ToastCtx = createContext(() => {})

export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const seq = useRef(0)

  const push = useCallback((text) => {
    seq.current += 1
    const id = seq.current
    setItems((list) => [...list, { id, text }])
    setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), 2600)
  }, [])

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((t) => (
          <div className="toast" key={t.id}>
            <Icon name="check" size={15} />
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export const useToast = () => useContext(ToastCtx)
