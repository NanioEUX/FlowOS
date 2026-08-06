"use client"

import dynamic from "next/dynamic"

const StoriesContent = dynamic(() => import("./page-content"), { ssr: false })

export default function StoriesPage() {
  return <StoriesContent />
}
