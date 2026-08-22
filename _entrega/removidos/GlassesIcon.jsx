function GlassesIcon({ frame = '#231712', lens = 'rgba(216, 180, 138, 0.35)' }) {
  return (
    <svg viewBox="0 0 120 60" width="100%" height="100%" role="presentation" aria-hidden="true">
      <g fill="none" stroke={frame} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="30" cy="32" r="21" fill={lens} />
        <circle cx="90" cy="32" r="21" fill={lens} />
        <path d="M51 28c3-6 15-6 18 0" />
        <path d="M9 26 1 16" />
        <path d="M111 26l8-10" />
      </g>
    </svg>
  )
}

export default GlassesIcon
