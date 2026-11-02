// F8D-026: o projeto tinha dois sistemas de tema incompatíveis — as classes
// `dark:` do Tailwind (que seguiam o SO, porque o config não declarava
// `darkMode`) e o estado JS do PDV/mesa/cardápio (que segue o usuário).
// Resultado: com o SO em claro, o dashboard (claro) ficava com componentes
// `ui/*` escuros, e o toggle do PDV não afetava as classes `dark:`.
//
// Agora o Tailwind usa `darkMode: "class"` e cada superfície declara o seu
// tema: o dashboard é claro por design, o PDV/mesa seguem o toggle manual.
export function applyDarkClass(isDark: boolean): void {
  if (typeof document === "undefined") return
  document.documentElement.classList.toggle("dark", isDark)
}

export function prefersDarkOS(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
  } catch {
    return false
  }
}
