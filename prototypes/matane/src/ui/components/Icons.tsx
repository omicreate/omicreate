/** 線だけの小さなアイコン（外部の画像やフォントは使わない） */
import type { SVGProps } from 'react'

const base: SVGProps<SVGSVGElement> = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
}

export function HomeIcon() {
  return (
    <svg {...base}>
      <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" />
    </svg>
  )
}

export function PeopleIcon() {
  return (
    <svg {...base}>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" />
    </svg>
  )
}

export function BoardIcon() {
  return (
    <svg {...base}>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M8 15.5v-3M12 15.5v-7M16 15.5v-5" />
    </svg>
  )
}

export function SettingsIcon() {
  return (
    <svg {...base}>
      <path d="M5 7h9M18 7h1M5 17h1M10 17h9" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="8" cy="17" r="2" />
    </svg>
  )
}

export function ChevronRight() {
  return (
    <svg {...base} width="18" height="18" className="chev">
      <path d="m9 6 6 6-6 6" />
    </svg>
  )
}

export function ChevronLeft() {
  return (
    <svg {...base} width="20" height="20">
      <path d="m15 6-6 6 6 6" />
    </svg>
  )
}

export function UpIcon() {
  return (
    <svg {...base} width="18" height="18">
      <path d="m6 15 6-6 6 6" />
    </svg>
  )
}

export function DownIcon() {
  return (
    <svg {...base} width="18" height="18">
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

/** またねカードを送ったときの印（円と✓を描く） */
export function SentMark() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true" focusable="false">
      <circle cx="28" cy="28" r="24" />
      <path d="M18 29l7 7 13-15" />
    </svg>
  )
}
