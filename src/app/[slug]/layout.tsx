import { InstallPWA } from "@/components/pwa/install-pwa"

export default function PublicSlugLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <InstallPWA />
    </>
  )
}
