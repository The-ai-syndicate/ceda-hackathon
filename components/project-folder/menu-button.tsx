"use client"

import type { Project } from "@/lib/data"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MoreVertical, Pencil, Trash2, X } from "lucide-react"

interface MenuButtonProps {
  project: Project
  onOpenChange?: (open: boolean) => void
  onRemove?: () => void
  onCancel?: () => void
  onRename?: () => void
  hideEdit?: boolean
  isVisible?: boolean
}

export function MenuButton({ project, onOpenChange, onRemove, onCancel, onRename, hideEdit, isVisible = false }: MenuButtonProps) {
  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          data-menu
          className={`p-1.5 rounded-md hover:bg-[#F3EEE6] transition-all duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#C9961E] ${
            isVisible ? "opacity-100" : "opacity-0"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical className="w-4 h-4 text-[#8C7B6A]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side="top"
        sideOffset={4}
        className="w-40 bg-white border-[#E7DED1] rounded-lg shadow-[0_8px_30px_rgba(110,44,36,0.12)]"
        onClick={(e) => e.stopPropagation()}
      >
        {project.isGenerating ? (
          <DropdownMenuItem
            className="group text-[#5D4037] hover:text-rose-600 focus:text-rose-600 focus:bg-[#F3EEE6] cursor-pointer gap-2 transition-colors"
            onClick={onCancel}
          >
            <X className="w-4 h-4 transition-colors group-hover:text-rose-600 group-focus:text-rose-600" />
            Cancel
          </DropdownMenuItem>
        ) : (
          <>
            {!hideEdit && (
              <DropdownMenuItem
                className="text-[#5D4037] focus:text-[#2A2118] focus:bg-[#F3EEE6] cursor-pointer gap-2"
                onClick={onRename}
              >
                <Pencil className="w-4 h-4" />
                Rename
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className="group text-[#5D4037] hover:text-rose-600 focus:text-rose-600 focus:bg-[#F3EEE6] cursor-pointer gap-2 transition-colors"
              onClick={onRemove}
            >
              <Trash2 className="w-4 h-4 transition-colors group-hover:text-rose-600 group-focus:text-rose-600" />
              Remove
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
