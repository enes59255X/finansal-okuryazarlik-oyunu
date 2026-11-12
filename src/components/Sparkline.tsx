interface SparklineProps {
  values: number[]
  width?: number
  height?: number
  tone?: 'up' | 'down' | 'flat'
}

export function Sparkline({ values, width = 132, height = 36, tone }: SparklineProps) {
  if (values.length < 2) {
    return <div className="h-9 w-[132px] rounded bg-slate-800/40" aria-hidden />
  }

  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const stepX = width / (values.length - 1)

  const points = values
    .map((value, index) => {
      const x = index * stepX
      const y = height - ((value - min) / span) * (height - 4) - 2
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  const direction = tone ?? (values[values.length - 1]! >= values[0]! ? 'up' : 'down')
  const color = direction === 'up' ? '#34d399' : direction === 'down' ? '#fb7185' : '#94a3b8'

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
