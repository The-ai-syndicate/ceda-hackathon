"use client"

import { useRef, useState } from "react"
import { motion } from "framer-motion"
import type { Project } from "@/lib/data"
import type { ImagePosition } from "./types"
import { SlotNumber } from "./slot-number"
import { MenuButton } from "./menu-button"
import { Sparkles } from "./sparkles"
import { ProjectPreview } from "./project-preview"
import { ProjectReport } from "./project-report"

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const

const TRANSITION_DURATION = 0.3
const TRANSITION_EASE = EASE_OUT_EXPO

interface DefaultProjectProps {
  project: Project
  isHovered: boolean
  setIsHovered: (value: boolean) => void
  isGenerating: boolean
  generationComplete: boolean
  progress: number
  sparklesFading: boolean
  showImages: boolean
  showGeneratingFooter: boolean
  imagePositions: ImagePosition[]
  clipCount: number
  remainingEta: string
  formattedDate: string
  onRemove?: () => void
  onCancel?: () => void
  onRename?: () => void
}

export function DefaultProject({
  project,
  isHovered,
  setIsHovered,
  isGenerating,
  generationComplete,
  progress,
  sparklesFading,
  showImages,
  showGeneratingFooter,
  imagePositions,
  clipCount,
  remainingEta,
  formattedDate,
  onRemove,
  onCancel,
  onRename,
}: DefaultProjectProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const reportDialogRef = useRef<HTMLDialogElement>(null)

  const isActive = (isHovered || isMenuOpen) && !isGenerating

  return (
    <div
      className={`group relative w-[288px] ${isGenerating ? "cursor-default" : "cursor-pointer"}`}
      style={{
        perspective: "1200px",
        zIndex: isActive ? 50 : 1,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => !isMenuOpen && setIsHovered(false)}
    >
      <div
        className="relative w-[288px]"
        style={{ perspective: "1200px" }}
      >
        <motion.div
          className="relative z-0 rounded-2xl"
          animate={{
            rotateX: isActive ? 15 : 0,
            backgroundColor: isGenerating ? "#F5F1EA" : "#FFFFFF",
          }}
          transition={{
            rotateX: {
              type: "spring",
              stiffness: 200,
              damping: 25,
              mass: 0.8,
            },
            backgroundColor: {
              duration: TRANSITION_DURATION,
              ease: TRANSITION_EASE,
            },
          }}
          style={{
            height: "224px",
            border: "1px solid #E7DED1",
            transformStyle: "preserve-3d",
            transformOrigin: "center bottom",
            boxShadow: isActive ? "0 12px 32px -12px rgba(110, 44, 36, 0.18)" : "0 4px 16px -8px rgba(110, 44, 36, 0.12)",
          }}
        >
          {project.isGenerating && <Sparkles count={16} fading={sparklesFading} variant="generating" />}
          <motion.div
            className="absolute inset-0"
            animate={{ rotateX: isActive ? -15 : 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 25, mass: 0.8 }}
            style={{ transformStyle: "flat", transformOrigin: "center bottom" }}
          >
            <ProjectPreview project={project} />
          </motion.div>
        </motion.div>

        <motion.div
          className="absolute bottom-0 left-0 right-0 z-10 rounded-2xl overflow-hidden"
          animate={{
            rotateX: isActive ? -25 : 0,
            backgroundColor: isGenerating ? "rgba(250, 248, 244, 0.92)" : "rgba(255, 255, 255, 0.88)",
          }}
          transition={{
            rotateX: {
              type: "spring",
              stiffness: 180,
              damping: 22,
              mass: 0.8,
            },
            backgroundColor: {
              duration: TRANSITION_DURATION,
              ease: TRANSITION_EASE,
            },
          }}
          style={{
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            border: "1px solid #E7DED1",
            transformStyle: "preserve-3d",
            transformOrigin: "center bottom",
          }}
        >
          <div className="relative py-4 px-4">
            <div className="relative z-0 min-h-[2.75rem]">
              <h3 className={`font-semibold text-[#5D4037] text-base leading-snug line-clamp-1 transition-colors duration-300 ${!isGenerating ? "group-hover:text-[#2A2118]" : ""}`}>
                {project.title}
              </h3>
              {project.developer && (
                <div className="mt-1 flex min-w-0 items-center justify-between gap-2">
                  <p className="truncate text-[10px] leading-3 text-[#8C7B6A]">{project.developer} · {project.securityStatus || project.processingStatus || "Submission"}</p>
                  {project.aiReport && <button type="button" data-menu onClick={(event) => { event.stopPropagation(); reportDialogRef.current?.showModal() }} className="shrink-0 text-[10px] leading-3 text-[#6E2C24] hover:text-[#8A3B2A]">Report</button>}
                </div>
              )}
            </div>
          </div>
          <div className="relative h-[48px]">
            <div className="absolute inset-x-0 top-0 h-[1px] bg-[#E7DED1]" />

            {isGenerating && progress < 100 && (
              <motion.div
                className="absolute top-0 left-0 h-[1px] bg-gradient-to-r from-[#8A3B2A] via-[#B85621] to-[#C9961E]"
                initial={{ width: "0%" }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.1, ease: "linear" }}
              />
            )}

            <div className="relative h-full">
              {isGenerating && !showImages ? (
                <motion.div
                  key="generating"
                  className="absolute inset-0 flex items-center justify-between px-2 pl-4"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 30,
                    mass: 0.8,
                    opacity: { duration: 0.15 },
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    <motion.svg
                      className="w-3 h-3 text-[#B85621]"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                    >
                      <path d="M12 0L14 10L24 12L14 14L12 24L10 14L0 12L10 10L12 0Z" />
                    </motion.svg>
                    <span className="text-[13px] text-transparent bg-clip-text bg-gradient-to-r from-[#8C7B6A] via-[#2A2118] to-[#8C7B6A] bg-[length:200%_100%] animate-shimmer">Generating</span>
                    {progress < 95 && <span className="text-[13px] text-[#8C7B6A]">{remainingEta}</span>}
                  </div>
                    {!project.storedInR2 && <MenuButton project={project} onOpenChange={setIsMenuOpen} onRemove={onRemove} onCancel={onCancel} onRename={onRename} isVisible={true} />}
                </motion.div>
              ) : (
                <motion.div
                  key="default"
                  className="absolute inset-0 flex items-center justify-between px-2 pl-4"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    type: "spring",
                    stiffness: 120,
                    damping: 18,
                    mass: 1,
                    opacity: { duration: 0.35, ease: "easeOut" },
                  }}
                >
                  <div className="flex min-w-0 items-center gap-1.5">
                    <SlotNumber value={project.technologies?.length ?? clipCount} isSpinning={false} />
                    <span className="truncate text-[11px] text-[#8C7B6A]">{project.technologies ? "technologies" : "clips"}</span>
                    {project.fileCount != null && <span className="truncate text-[10px] text-[#B8A99A]">· {project.fileCount} files</span>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-[10px] text-[#8C7B6A]">{formattedDate}</span>
                  {!project.storedInR2 && <MenuButton project={project} onOpenChange={setIsMenuOpen} onRemove={onRemove} onCancel={onCancel} onRename={onRename} isVisible={true} />}
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
      {project.aiReport && <ProjectReport project={project} dialogRef={reportDialogRef} />}
    </div>
  )
}
