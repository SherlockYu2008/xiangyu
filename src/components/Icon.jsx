// 全部图标用内联 SVG，不引第三方图标库（少一个依赖，少一点打包体积）
const P = {
  home: 'M3 10.6 12 3l9 7.6V21a1 1 0 0 1-1 1h-5.5v-6h-5v6H4a1 1 0 0 1-1-1z',
  compass: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z|M15.4 8.6l-2.2 5-4.6 1.8 2.2-5z',
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  sparkles: 'M12 3.5l1.7 4.6 4.6 1.7-4.6 1.7L12 16.1l-1.7-4.6L5.7 9.8l4.6-1.7z|M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z',
  chat: 'M4.5 20.5 6 16.6A8 8 0 1 1 9.4 20L4.5 20.5Z|M9 11h6M9 8h4',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z|M4.5 21a7.5 7.5 0 0 1 15 0',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z|M16.2 16.2 21 21',
  plus: 'M12 5v14M5 12h14',
  arrowRight: 'M4 12h15M13.5 6.5 19.5 12l-6 5.5',
  arrowLeft: 'M20 12H5M10.5 6.5 4.5 12l6 5.5',
  check: 'M4.5 12.5 9.5 17.5 20 6.5',
  x: 'M6 6l12 12M18 6 6 18',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z|M12 7.5V12l3 2',
  pin: 'M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z|M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  users: 'M9 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z|M2.5 20a6.5 6.5 0 0 1 13 0|M16.5 5.6a3.4 3.4 0 0 1 0 6.5M18 20a6.6 6.6 0 0 0-2.2-4.9',
  bell: 'M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z|M10 20.5h4',
  send: 'M21 3 10.5 13.5|M21 3l-6.5 18-4-8-8-3.5z',
  logout: 'M9.5 21H5.5A1.5 1.5 0 0 1 4 19.5v-15A1.5 1.5 0 0 1 5.5 3h4|M16 16.5l4.5-4.5L16 7.5|M20.5 12H9',
  edit: 'M12.5 20H21|M16.5 3.5a2.1 2.1 0 0 1 3 3L7.5 18.5 3.5 19.5l1-4z',
  shield: 'M12 3.2 20 6v6c0 5-3.6 8.2-8 9.3-4.4-1.1-8-4.3-8-9.3V6z|M9 12l2.2 2.2L15.5 10',
  refresh: 'M20.5 12a8.5 8.5 0 1 1-2.9-6.4|M20.5 3.5v6h-6',
  flame: 'M12 21c3.6 0 6-2.4 6-5.6 0-3.6-3.6-5.4-3.6-8.4 0 0-3.4 1.6-3.4 5.2 0 1.1.5 2 .5 2S9 12.6 9 15c0 3 1 6 3 6Z',
  filter: 'M3.5 5.5h17|M6.5 12h11|M10 18.5h4',
  heart: 'M12 20.5s-7.5-4.6-7.5-10A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 7.5 3.5c0 5.4-7.5 10-7.5 10Z',
  star: 'M12 3.5l2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6-4.4-4.2 6-.8z',
  wave: 'M3 12c3 0 3-6 6-6s3 12 6 12 3-6 6-6',
  image: 'M4 5.5h16v13H4z|M4 15.5 9 11l4 4 2.5-2.5L20 17|M9.2 10a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6Z',
  book: 'M5 4.5h9.5A2.5 2.5 0 0 1 17 7v13H7.5A2.5 2.5 0 0 1 5 17.5z|M5 17.5A2.5 2.5 0 0 1 7.5 15H17',
  camera: 'M4 8.5h3l1.5-2h7L17 8.5h3v11H4z|M12 17.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
  friends: 'M8.5 12a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z|M2.5 20a6 6 0 0 1 12 0|M16 6.2a3 3 0 0 1 0 5.6M18 20a6 6 0 0 0-1.8-4.3',
  file: 'M6.5 3.5h6.5l4.5 4.5V20a.5.5 0 0 1-.5.5H6.5a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5Z|M13 3.5V8h4.5|M8.5 12.5h7M8.5 16h5',
}

export default function Icon({ name, size = 20, className = '', strokeWidth = 1.8, fill = 'none' }) {
  const d = P[name]
  if (!d) return null
  const parts = d.split('|')
  return (
    <svg
      className={`ico ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {parts.map((p, i) => (
        <path key={i} d={p} />
      ))}
    </svg>
  )
}

export function Mark({ size = 34 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id="xy-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5b55f0" />
          <stop offset="0.6" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#c084fc" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="14" fill="url(#xy-mark)" />
      <path
        d="M10 29c4.5 0 4.5-11 9-11s4.5 11 9 11 4.5-9 9-9"
        fill="none"
        stroke="#fff"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
    </svg>
  )
}
