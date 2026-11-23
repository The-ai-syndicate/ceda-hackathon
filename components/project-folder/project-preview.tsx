import type { Project } from "@/lib/data"

export const codeTokens = (code: string) => code.split(/(\/\/[^\n]*|#[^\n]*|"[^"\n]*"|'[^'\n]*'|`[^`\n]*`|\b(?:const|let|var|function|return|export|default|import|from|class|async|await|if|else|new|def|class|true|false|null|None)\b|\b\d+\b)/g).map((token, index) => {
  const color = /^(\/\/|#)/.test(token) ? "text-[#8C7B6A]" : /^(\"|'|`)/.test(token) ? "text-[#2E7D32]" : /^(const|let|var|function|return|export|default|import|from|class|async|await|if|else|new|def|true|false|null|None)$/.test(token) ? "text-[#6E2C24]" : /^\d+$/.test(token) ? "text-[#B85621]" : "text-[#3E2723]"
  return <span key={index} className={color}>{token}</span>
})

const architectureNodes = (project: Project) => {
  const labels = ["Client", ...(project.technologies?.some((tech) => /api|express|fastapi|django|nestjs/i.test(tech)) ? ["API"] : []), ...(project.technologies?.some((tech) => /postgres|mongo|redis|firebase|supabase/i.test(tech)) ? ["Data"] : []), ...(project.technologies?.some((tech) => /ai sdk/i.test(tech)) ? ["AI service"] : [])]
  return labels.slice(0, 4)
}

export function ProjectPreview({ project }: { project: Project }) {
  const kind = project.previewKind || "frontend"
  const codePanels = project.snippets || []
  const panels = kind === "frontend" && project.images?.length
    ? project.images.slice(0, 5).map((image, index) => ({ type: "image" as const, src: image, name: `Application screenshot ${index + 1}` }))
    : kind === "fullstack" && project.images?.length
      ? [
          { type: "image" as const, src: project.images[0], name: "Application screenshot" },
          ...codePanels.slice(0, 4).map((snippet) => ({ type: "code" as const, ...snippet })),
        ]
      : kind === "architecture"
        ? [{ type: "architecture" as const }, ...codePanels.slice(0, 4).map((snippet) => ({ type: "code" as const, ...snippet }))]
        : codePanels.length
          ? codePanels.slice(0, 5).map((snippet) => ({ type: "code" as const, ...snippet }))
          : [{ type: "terminal" as const }, ...codePanels.slice(0, 4).map((snippet) => ({ type: "code" as const, ...snippet }))]
  const stack = panels.length ? panels : [{ type: "terminal" as const }]
  const visiblePanels = stack.length === 1 ? [...stack, ...stack, ...stack, ...stack, ...stack] : stack

  return (
    <div className="absolute inset-0 overflow-hidden" aria-label={`${kind} project preview`}>
      {visiblePanels.slice(0, 5).map((panel, index) => {
        const distance = Math.abs(index - 2)
        const positions = [-93, -48, 0, 48, 93]
        const rotation = [-12, -7, 0, 7, 12]
        return (
          <div
            key={`${index}-${panel.type}`}
            className="absolute left-1/2 top-[20px] h-[145px] w-[116px] overflow-hidden rounded-lg border border-[#E7DED1] bg-[#FAF8F4] shadow-xl"
            style={{
              zIndex: 10 - distance,
              transform: `translateX(calc(-50% + ${positions[index]}px)) translateY(${distance === 0 ? -10 : 0}px) rotate(${rotation[index]}deg) scale(${distance === 0 ? 1.04 : distance === 1 ? 0.94 : 0.84})`,
              opacity: distance === 0 ? 1 : distance === 1 ? 0.82 : 0.6,
              filter: distance > 1 ? "blur(.35px)" : undefined,
            }}
          >
            {panel.type === "image" && <img src={panel.src} alt={panel.name} className="size-full object-cover" />}
            {panel.type === "code" && (
              <div className="h-full bg-white font-mono">
                <div className="flex h-6 items-center gap-1.5 border-b border-[#E7DED1] bg-[#F5F1EA] px-2">
                  <i className="size-1.5 rounded-full bg-[#E0B33A]" /><i className="size-1.5 rounded-full bg-[#D4712E]" /><i className="size-1.5 rounded-full bg-[#0F9B8E]" />
                  <span className="ml-1 truncate text-[7px] text-[#8C7B6A]">{panel.fileName}</span>
                </div>
                <pre className="overflow-hidden p-2 text-[6.5px] leading-[1.75]">{codeTokens(panel.code)}</pre>
              </div>
            )}
            {panel.type === "architecture" && (
              <div className="flex h-full flex-col items-center justify-center gap-2 bg-white p-2">
                <span className="font-mono text-[7px] uppercase tracking-[.16em] text-[#8C7B6A]">system map</span>
                <div className="flex flex-col items-center gap-1">
                  {architectureNodes(project).map((node, nodeIndex) => <div key={node} className="relative rounded border border-[#C9961E]/30 bg-[#C9961E]/[0.08] px-3 py-1 font-mono text-[7px] text-[#6E2C24]">{node}{nodeIndex < architectureNodes(project).length - 1 && <span className="absolute left-1/2 top-full h-1 w-px bg-[#C9961E]/40" />}</div>)}
                </div>
                <span className="max-w-full truncate font-mono text-[6px] text-[#8C7B6A]">{project.technologies?.slice(0, 3).join(" · ") || "inferred from archive"}</span>
              </div>
            )}
            {panel.type === "terminal" && (
              <div className="h-full bg-white p-2 font-mono text-[7px] leading-4 text-[#2E7D32]">
                <div className="mb-1 truncate text-[#8C7B6A]">$ {project.title.toLowerCase().replace(/[^a-z0-9-]+/g, "-")}</div>
                <div className="text-[#3E2723]">{project.fileCount ?? 0} files analysed</div>
                {project.fileNames?.slice(0, 5).map((name, fileIndex) => <div key={`${name}-${fileIndex}`} className="truncate text-[#8C7B6A]">{fileIndex === Math.min((project.fileNames?.length || 1) - 1, 4) ? "└─" : "├─"} {name}</div>)}
                <div className="mt-1 truncate text-[#B85621]">{project.technologies?.slice(0, 2).join(" · ") || "technical project"}</div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
