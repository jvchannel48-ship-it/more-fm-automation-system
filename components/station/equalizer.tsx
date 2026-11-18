const BARS = [
  0.55, 0.95, 0.7, 1.15, 0.6, 1.05, 0.8, 1.25, 0.65, 0.9, 0.75, 1.1, 0.5, 0.85, 1.0, 0.68,
]

export function Equalizer({ active }: { active: boolean }) {
  return (
    <div className="eq-deck flex h-8 items-end justify-center gap-[3px]" aria-hidden="true">
      {BARS.map((speed, i) => (
        <span
          key={i}
          className="eq-bar w-[3px] origin-bottom rounded-full sm:w-1"
          style={{
            height: '100%',
            animation: active ? `eq ${speed}s ease-in-out ${i * 0.05}s infinite` : 'none',
            transform: active ? undefined : 'scaleY(0.18)',
            opacity: active ? undefined : 0.35,
            animationDelay: active ? `${i * 0.05}s` : undefined,
          }}
        />
      ))}
    </div>
  )
}
