import atlas from "@/public/assets/applebrook/village.json";

export default function PixelSprite({ name, size = 48, className = "" }: { name: string; size?: number; className?: string }) {
  const sprite = (atlas.frames as Record<string, { frame: { x: number; y: number; w: number; h: number } }>)[name]?.frame;
  if (!sprite) return null;
  const scale = Math.min(size / sprite.w, size / sprite.h);
  return <span className={`pixel-sprite ${className}`} aria-hidden="true" style={{ width: size, height: size }}><span style={{ width: sprite.w * scale, height: sprite.h * scale, backgroundImage: "url('/assets/applebrook/village.png')", backgroundSize: `${1024 * scale}px ${1024 * scale}px`, backgroundPosition: `${-sprite.x * scale}px ${-sprite.y * scale}px` }} /></span>;
}
