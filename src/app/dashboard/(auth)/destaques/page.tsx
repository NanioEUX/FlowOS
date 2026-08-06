"use client"

import dynamic from "next/dynamic"

const DestaquesContent = dynamic(() => import("./page-content"), { ssr: false })

export default function DestaquesPage() {
  return <DestaquesContent />
}
