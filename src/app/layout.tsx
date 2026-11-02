import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import { Providers } from "@/components/providers"
import { OfflineBanner } from "@/components/offline-banner"
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register"
import { UpdateBanner } from "@/components/pwa/update-banner"
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
  width: "device-width",
  initialScale: 1,
  // F8D-003: sem maximumScale/userScalable — zoom é acessibilidade (WCAG 1.4.4)
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        {/* F8D-026: aplica o tema antes da primeira pintura (evita flash) nas
            telas que têm toggle próprio (PDV e mesa do cliente). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var p=location.pathname;if(p.indexOf('/caixa')===0||p.indexOf('/mesa/')>-1){var t=localStorage.getItem('pedefacil-caixa-theme');if(t==='light'){document.documentElement.classList.remove('dark')}else{document.documentElement.classList.add('dark')}}}catch(e){}})()`,
          }}
        />
        <OfflineBanner />
        <Providers>{children}</Providers>
        <ServiceWorkerRegister />
        <UpdateBanner />
      </body>
    </html>
  )
}
