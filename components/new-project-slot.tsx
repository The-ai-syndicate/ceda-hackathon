"use client"

import { useState, useEffect, useRef } from "react"

interface NewProjectSlotProps {
  onFileSelected: (file: File) => void
  isAnalyzing?: boolean
}

export function NewProjectSlot({ onFileSelected, isAnalyzing = false }: NewProjectSlotProps) {
  const [isHovered, setIsHovered] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [displayedText, setDisplayedText] = useState("")
  const [isTypingComplete, setIsTypingComplete] = useState(false)
  const fullText = isAnalyzing ? "Checking ZIP integrity, source and dependencies..." : "ZIP saved privately in R2; analysed by the CEDA review engine..."

  useEffect(() => {
    if (isHovered) {
      setDisplayedText("")
      setIsTypingComplete(false)
      let currentIndex = 0
      const interval = setInterval(() => {
        if (currentIndex <= fullText.length) {
          setDisplayedText(fullText.slice(0, currentIndex))
          currentIndex++
        } else {
          clearInterval(interval)
          setIsTypingComplete(true)
        }
      }, 60)
      return () => clearInterval(interval)
    } else {
      setDisplayedText("")
      setIsTypingComplete(false)
    }
  }, [isHovered, fullText])

  return (
    <div
      className="group relative cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9961E]/50"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(event) => { if (event.target !== fileInputRef.current && !isAnalyzing) fileInputRef.current?.click() }}
      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); if (!isAnalyzing) fileInputRef.current?.click() } }}
      role="button"
      tabIndex={0}
      aria-label="Upload a project ZIP"
      aria-description="ZIP files are checked on the server and saved in a private R2 bucket. Redacted source excerpts and file metadata are processed by the CEDA review engine; resolved package names and versions from supported lockfiles are checked against OSV."
      aria-busy={isAnalyzing}
      aria-disabled={isAnalyzing}
    >
      <input
        ref={fileInputRef}
        type="file"
        disabled={isAnalyzing}
        accept=".zip,application/zip"
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          if (file) onFileSelected(file)
          event.currentTarget.value = ""
        }}
      />
      <div
        className="relative w-[288px] transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]"
        style={{ perspective: "1200px" }}
      >
        <div
          className="absolute inset-0 z-20 flex items-start justify-center px-6 pt-12 transition-opacity duration-300 pointer-events-none"
          style={{ opacity: isHovered ? 1 : 0 }}
        >
          <p
            className="text-sm text-[#5D4037] font-mono text-center"
            style={{
              lineHeight: "20px",
            }}
          >
            {displayedText}
            {isHovered && (
              <span
                className="inline-block w-[2px] h-[14px] bg-[#8C7B6A] ml-0.5"
                style={{
                  verticalAlign: "text-bottom",
                  animation: isTypingComplete ? "blink 1s step-end infinite" : "none",
                }}
              />
            )}
          </p>
        </div>

        <style jsx>{`
          @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0; }
          }
        `}</style>

        <div
          className="relative z-0 rounded-2xl transition-all duration-500"
          style={{
            height: "224px",
            transformStyle: "preserve-3d",
            transformOrigin: "center bottom",
            transform: isHovered ? "rotateX(15deg)" : "rotateX(0deg)",
            background: "#FAF8F4",
            border: "1px dashed #C9BFAE",
          }}
        ></div>

        <div
          className="absolute bottom-0 left-0 right-0 z-10 rounded-2xl overflow-hidden transition-all duration-500"
          style={{
            background: "rgba(255, 255, 255, 0.92)",
            border: "1px dashed #C9BFAE",
            transformStyle: "preserve-3d",
            transformOrigin: "center bottom",
            transform: isHovered ? "rotateX(-25deg)" : "rotateX(0deg)",
          }}
        >
          <div className="relative py-4 px-4">
            <h3 className="font-semibold text-[#5D4037] text-base leading-snug line-clamp-2 min-h-[2.75rem] transition-colors duration-300 group-hover:text-[#2A2118]">
              {isAnalyzing ? "Analysing Submission" : "Upload Submission"}
            </h3>
          </div>
          <div className="relative h-[48px]">
            <div className="absolute inset-x-0 top-0 h-[1px] border-t border-dashed border-[#E7DED1]" />
            <div className="absolute inset-0 flex items-center justify-between px-4">
              <span className="text-[13px] text-[#8C7B6A] transition-colors duration-300 group-hover:text-[#5D4037]">
                {isAnalyzing ? "Checking files and dependencies…" : "Static checks · Automated review"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
