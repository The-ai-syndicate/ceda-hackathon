import type React from "react"
import type { Metadata } from "next"
import { Inter, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { GenerationProvider } from "@/contexts/generation-context"
import "./globals.css"

const _inter = Inter({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "CEDA Hackathon | Participant Dashboard",
  description: "Submit, track, and review your hackathon project in real time. CEDA — Finance, Develop, Sustain.",
  generator: "v0.app",
  icons: {
    icon: [
      {
        url: "/ceda-icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/ceda-icon.svg",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased`}>
        <GenerationProvider>{children}</GenerationProvider>
        <Analytics />
      </body>
    </html>
  )
}
