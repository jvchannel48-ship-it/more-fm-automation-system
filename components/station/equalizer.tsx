const BARS = [0.9, 0.6, 1.1, 0.7, 1, 0.5, 0.8, 1.2, 0.65, 0.95, 0.55, 0.85]

export function Equalizer({ active }: { active: boolean }) {
  return (
    <div className="flex h-6 items-end gap-1" aria-hidden="true">
      {BARS.map((speed, i) => (
        <span
          key={i}
          className="h-full w-1 origin-bottom rounded-full bg-primary"
          style={{
            animation: active ? `eq ${speed}s ease-in-out ${i * 0.07}s infinite` : 'none',
            transform: active ? undefined : 'scaleY(0.2)',
          }}
        />
      ))}
    </div>
  )
}
