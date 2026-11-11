import { useEffect, useRef } from 'react'
import { AreaSeries, ColorType, createChart, type UTCTimestamp } from 'lightweight-charts'
import type { PricePoint } from '../lib/types'

interface PriceChartProps {
  points: PricePoint[]
  height?: number
}

export function PriceChart({ points, height = 300 }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const chart = createChart(container, {
      autoSize: true,
      height,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#94a3b8',
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: 'rgba(148, 163, 184, 0.08)' },
        horzLines: { color: 'rgba(148, 163, 184, 0.08)' },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
      crosshair: {
        vertLine: { color: 'rgba(16, 185, 129, 0.4)', labelBackgroundColor: '#065f46' },
        horzLine: { color: 'rgba(16, 185, 129, 0.4)', labelBackgroundColor: '#065f46' },
      },
      handleScroll: false,
      handleScale: false,
    })

    const series = chart.addSeries(AreaSeries, {
      lineColor: '#34d399',
      topColor: 'rgba(52, 211, 153, 0.35)',
      bottomColor: 'rgba(52, 211, 153, 0.02)',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
    })

    const seen = new Set<number>()
    const data = points
      .map((point) => ({
        time: Math.floor(new Date(point.recorded_at).getTime() / 1000) as UTCTimestamp,
        value: Number(point.price),
      }))
      .filter((point) => {
        if (seen.has(point.time)) return false
        seen.add(point.time)
        return true
      })
      .sort((a, b) => a.time - b.time)

    series.setData(data)
    if (data.length > 1) chart.timeScale().fitContent()

    return () => chart.remove()
  }, [points, height])

  if (points.length === 0) {
    return (
      <div className="grid h-[300px] place-items-center rounded-xl border border-dashed border-slate-700/60 text-sm text-slate-500">
        Bu varlık için fiyat geçmişi henüz yok.
      </div>
    )
  }

  return <div ref={containerRef} className="w-full" style={{ height }} />
}
