interface FlowOSLogoProps {
  size?: number
  variant?: "full" | "icon" | "wordmark"
  className?: string
}

export function FlowOSLogo({ size = 32, variant = "full", className = "" }: FlowOSLogoProps) {
  const iconSize = size * 0.85
  const fontSize = size * 0.34

  const Icon = ({ id = "" }: { id?: string }) => (
    <svg width={iconSize} height={iconSize} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`top${id}`} x1="4" y1="18" x2="42" y2="6" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1E7BFF" />
          <stop offset="60%" stopColor="#17D7FF" />
          <stop offset="100%" stopColor="#17D7FF" />
        </linearGradient>
        <linearGradient id={`mid${id}`} x1="4" y1="26" x2="38" y2="14" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#17D7FF" />
          <stop offset="50%" stopColor="#00D98B" />
          <stop offset="100%" stopColor="#00D98B" />
        </linearGradient>
        <linearGradient id={`bot${id}`} x1="4" y1="34" x2="32" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00D98B" />
          <stop offset="100%" stopColor="#00D98B" />
        </linearGradient>
        <filter id={`shadow${id}`}>
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#000" floodOpacity="0.3" />
        </filter>
      </defs>
      {/* Top ribbon - longest, blue→cyan */}
      <path
        d="M6 21C6 18 8 13 14 10C20 7 30 6 38 8C42 9 44 11 43 14C42 17 36 18 28 17C20 16 12 18 8 21L6 21Z"
        fill={`url(#top${id})`}
      />
      {/* Middle ribbon - medium, cyan→green */}
      <path
        d="M6 29C6 26 9 21 15 18C21 15 30 14 36 16C40 17 41 20 40 22C39 25 32 26 25 25C18 24 11 26 8 29L6 29Z"
        fill={`url(#mid${id})`}
      />
      {/* Bottom ribbon - shortest, green */}
      <path
        d="M6 37C6 34 10 29 16 27C22 25 28 25 31 27C33 28 33 31 31 33C29 35 24 36 19 35C14 34 9 36 7 37L6 37Z"
        fill={`url(#bot${id})`}
      />
    </svg>
  )

  if (variant === "icon") return <div className={className}><Icon id="icon" /></div>

  if (variant === "wordmark") {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Icon id="wm" />
        <div className="flex items-baseline">
          <span className="font-bold text-flow-white" style={{ fontSize, letterSpacing: "-0.04em" }}>Flow</span>
          <span className="font-bold" style={{ fontSize, letterSpacing: "-0.04em", background: "linear-gradient(135deg, #00D98B, #17D7FF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>OS</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <Icon id="full" />
      <div className="flex flex-col">
        <div className="flex items-baseline">
          <span className="font-bold text-flow-white" style={{ fontSize, letterSpacing: "-0.04em" }}>Flow</span>
          <span className="font-bold" style={{ fontSize, letterSpacing: "-0.04em", background: "linear-gradient(135deg, #00D98B, #17D7FF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>OS</span>
        </div>
        {size >= 28 && (
          <div className="flex items-center gap-2 mt-0.5">
            <div className="h-px w-4 bg-flow-green/60" />
            <span className="font-medium uppercase text-flow-gray" style={{ fontSize: fontSize * 0.38, letterSpacing: "0.35em" }}>
              Food Service OS
            </span>
            <div className="h-px w-4 bg-flow-cyan/60" />
          </div>
        )}
      </div>
    </div>
  )
}

export function Favicon() {
  return (
    <svg width="32" height="32" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="12" fill="#07101D" />
      <defs>
        <linearGradient id="ft" x1="4" y1="18" x2="42" y2="6" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1E7BFF" />
          <stop offset="60%" stopColor="#17D7FF" />
        </linearGradient>
        <linearGradient id="fm" x1="4" y1="26" x2="38" y2="14" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#17D7FF" />
          <stop offset="100%" stopColor="#00D98B" />
        </linearGradient>
        <linearGradient id="fb" x1="4" y1="34" x2="32" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00D98B" />
          <stop offset="100%" stopColor="#00D98B" />
        </linearGradient>
      </defs>
      <path d="M6 21C6 18 8 13 14 10C20 7 30 6 38 8C42 9 44 11 43 14C42 17 36 18 28 17C20 16 12 18 8 21L6 21Z" fill="url(#ft)" />
      <path d="M6 29C6 26 9 21 15 18C21 15 30 14 36 16C40 17 41 20 40 22C39 25 32 26 25 25C18 24 11 26 8 29L6 29Z" fill="url(#fm)" />
      <path d="M6 37C6 34 10 29 16 27C22 25 28 25 31 27C33 28 33 31 31 33C29 35 24 36 19 35C14 34 9 36 7 37L6 37Z" fill="url(#fb)" />
    </svg>
  )
}
