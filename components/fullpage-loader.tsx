"use client"

import { useEffect, useState } from "react"
import Image from "next/image"

interface FullpageLoaderProps {
  duration?: number
  onComplete?: () => void
}

export function FullpageLoader({ duration = 1600, onComplete }: FullpageLoaderProps) {
  const [isVisible, setIsVisible] = useState(true)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    const exitTimer = setTimeout(() => {
      setIsExiting(true)
    }, duration - 100)

    const hideTimer = setTimeout(() => {
      setIsVisible(false)
      onComplete?.()
    }, duration + 600)

    return () => {
      clearTimeout(exitTimer)
      clearTimeout(hideTimer)
    }
  }, [duration, onComplete])

  useEffect(() => {
    const startTime = Date.now()
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const linearProgress = Math.min(elapsed / duration, 1)
      const easedProgress = 1 - Math.pow(1 - linearProgress, 3)
      setLoadingProgress(easedProgress * 100)

      if (linearProgress >= 1) {
        clearInterval(interval)
      }
    }, 16)
    return () => clearInterval(interval)
  }, [duration])

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#FAF8F4]">
      <div
        style={{
          opacity: isExiting ? 0 : 1,
          transform: isExiting ? "scale(0.96) translateY(-52px)" : "scale(1) translateY(-40px)",
          transition: "opacity 600ms cubic-bezier(0.32, 0.72, 0, 1), transform 600ms cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        <div className="flex flex-col items-center">
          <div className="mb-6 flex h-16 w-24 items-center justify-center rounded-2xl border border-[#E7DED1] bg-white overflow-hidden shadow-lg">
            <Image
              src="/logo-lockup.png"
              alt="CEDA"
              width={281}
              height={167}
              className="h-11 w-auto object-contain"
              priority
            />
          </div>
          <h1 className="font-semibold tracking-tight text-[#2A2118] text-2xl">CEDA Hackathon</h1>
          <p className="mt-1 text-[11px] text-[#8C7B6A] tracking-[0.18em] uppercase">Finance · Develop · Sustain</p>
          <div className="mt-5 w-52">
            <div className="rounded-full bg-[#F3EEE6] overflow-hidden h-1.5 w-full">
              <div
                className="h-full rounded-full transition-[width] duration-100"
                style={{
                  width: `${loadingProgress}%`,
                  background: "linear-gradient(90deg, #8A3B2A, #B85621, #C9961E)",
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
