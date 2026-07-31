import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import { Providers } from "@/components/providers"
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "FlowOS - Cardápio Digital",
  description: "Sistema de pedidos online para seu estabelecimento",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.svg?v=2", type: "image/svg+xml" },
      { url: "/favicon.ico?v=2", sizes: "any" },
      { url: "/favicon.png?v=2", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-192.png?v=2", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png?v=2", sizes: "512x512", type: "image/png" },
    ],
  },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "FlowOS" },
}

export const viewport: Viewport = {
  themeColor: "#1E7BFF",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}><Providers>{children}</Providers><ServiceWorkerRegister /></body>
    </html>
  )
}
