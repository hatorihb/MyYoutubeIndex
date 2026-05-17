import { useRef, useState, useEffect } from 'react'

export default function ScrollRow({ children, gap = 'gap-2' }) {
  const ref = useRef(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(true)

  const update = () => {
    const el = ref.current
    if (!el) return
    setCanLeft(el.scrollLeft > 2)
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2)
  }

  useEffect(() => {
    const el = ref.current
    if (!el) return
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    el.addEventListener('scroll', update, { passive: true })
    return () => { ro.disconnect(); el.removeEventListener('scroll', update) }
  }, [])

  return (
    <div className="relative -mx-4">
      {canLeft && (
        <button
          onClick={() => ref.current.scrollBy({ left: -180, behavior: 'smooth' })}
          className="absolute left-0 top-0 bottom-1 z-10 flex items-center pl-1 pr-4 bg-gradient-to-r from-white via-white to-transparent"
          aria-label="左にスクロール"
        >
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
      )}
      <div
        ref={ref}
        className="overflow-x-auto px-4"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <div className={`flex ${gap} w-max pb-1`}>
          {children}
        </div>
      </div>
      {canRight && (
        <button
          onClick={() => ref.current.scrollBy({ left: 180, behavior: 'smooth' })}
          className="absolute right-0 top-0 bottom-1 z-10 flex items-center pr-1 pl-4 bg-gradient-to-l from-white via-white to-transparent"
          aria-label="右にスクロール"
        >
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
          </svg>
        </button>
      )}
    </div>
  )
}
