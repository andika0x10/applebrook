import type { CSSProperties } from "react";

const paths: Record<string, React.ReactNode> = {
  leaf: <><path d="M19 4C9 2 3 7 5 14c1 4 7 5 11 1 3-3 3-7 3-11Z"/><path d="m4 21 11-12M8 16v-5m4 1h5"/></>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></>,
  moon: <path d="M20 14A8.5 8.5 0 0 1 10 4a8.5 8.5 0 1 0 10 10Z"/>,
  wheat: <><path d="M7 21 17 4M10 16c-5 0-6-4-6-4 4-1 6 1 6 4Zm3-5C9 10 9 6 9 6c4 0 5 2 4 5Zm-3 5c3-4 7-2 7-2-1 4-4 5-7 2Zm4-7c1-4 5-4 5-4 1 4-1 6-5 4Z"/></>,
  apple: <><path d="M12 7c-6-5-12 2-7 10 3 5 5 3 7 3s4 2 7-3c5-8-1-15-7-10Zm0 0c-1-3 0-5 3-5"/><path d="M11 5C7 6 6 3 6 3c3-1 5 0 5 2Z"/></>,
  wood: <><path d="m7 6 9 5m-9 7 10-6M5 5l14 8-5 8L1 13 5 5Z"/><ellipse cx="16.5" cy="16.5" rx="3.3" ry="4.5" transform="rotate(30 16.5 16.5)"/></>,
  coin: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="6"/><path d="M14 9h-3a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4m-1-9v1m0 8v1"/></>,
  people: <><circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5"/></>,
  build: <><path d="m3 21 10-10m0-6 3-3 6 6-3 3-2-2-4 4-3-3 4-4-1-1Z"/><path d="m2 20 2 2m12-9 6 6-3 3-6-6"/></>,
  barn: <><path d="M3 10 12 3l9 7v11H3V10Zm-2 0 11-9 11 9M8 21V11h8v10m-8-9 8 9m0-9-8 9"/><path d="M10 6h4"/></>,
  house: <><path d="m2 11 10-9 10 9M5 9v12h14V9m-9 12v-8h4v8"/></>,
  book: <><path d="M12 5C8 2 3 3 2 4v16c4-2 7-1 10 1 3-2 6-3 10-1V4c-3-2-7-1-10 1Zm0 0v16"/><path d="M5 8h4m-4 4h4m6-4h4m-4 4h4"/></>,
  sliders: <><path d="M5 3v7m0 4v7M12 3v12m0 4v2M19 3v2m0 4v12"/><path d="M2 10h6M9 15h6m1-10h6"/></>,
  flag: <><path d="M5 22V3c5-4 9 4 14 0v11c-5 4-9-4-14 0"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  close: <path d="m6 6 12 12M6 18 18 6"/>,
  plus: <path d="M12 5v14M5 12h14"/>,
  minus: <path d="M5 12h14"/>,
  pause: <><path d="M7 5h3v14H7zM14 5h3v14h-3z"/></>,
  play: <path d="m8 4 12 8-12 8V4Z"/>,
  help: <><circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 5 2c-1 1-2 1-2 3m0 3h.01"/></>,
  focus: <><circle cx="12" cy="12" r="5"/><path d="M12 2v5m0 10v5M2 12h5m10 0h5"/></>,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6"/>,
  chevron: <path d="m8 4 8 8-8 8"/>,
  sound: <><path d="m11 4-6 5H2v6h3l6 5V4Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></>,
  mute: <><path d="m11 4-6 5H2v6h3l6 5V4Zm5 5 6 6m0-6-6 6"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></>,
  snow: <><path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 4l3 3 3-3M9 20l3-3 3 3M4 10l4-1-1-4m13 9-4 1 1 4M4 14l4 1-1 4m13-9-4-1 1-4"/></>,
  flour: <><path d="m7 3 2 5-4 7c-3 6 17 6 14 0l-4-7 2-5H7Zm2 5h6"/><path d="m10 16 3-5m-2 3 3 1"/></>,
  bread: <><path d="M5 18c-4-3-3-9 0-11s12-2 15 2c4 5-1 11-6 11H7l-2-2Z"/><path d="m7 8 2 5m3-6 2 5m3-3 1 4"/></>,
  map: <><path d="m2 5 6-3 8 3 6-3v17l-6 3-8-3-6 3V5Zm6-3v17m8-14v17"/></>,
};
export default function Icon({ name, size = 20, style, className = "" }: { name: string; size?: number; style?: CSSProperties; className?: string }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}>{paths[name] ?? paths.leaf}</svg>;
}
