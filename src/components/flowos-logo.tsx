interface FlowOSLogoProps {
  size?: number
  variant?: "full" | "icon" | "wordmark"
  className?: string
}

export function FlowOSLogo({ size = 32, variant = "full", className = "" }: FlowOSLogoProps) {
  const iconSize = size * 0.9
  const fontSize = size * 0.33

  const Icon = ({ id = "" }: { id?: string }) => (
    <svg width={iconSize} height={iconSize} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`g1${id}`} x1="0" y1="0" x2="40" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1E7BFF" />
          <stop offset="100%" stopColor="#17D7FF" />
        </linearGradient>
        <linearGradient id={`g2${id}`} x1="0" y1="0" x2="42" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#17D7FF" />
          <stop offset="100%" stopColor="#00D98B" />
        </linearGradient>
        <linearGradient id={`g3${id}`} x1="0" y1="0" x2="36" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00D98B" />
          <stop offset="100%" stopColor="#00D98B" />
        </linearGradient>
      </defs>
      {/* Top ribbon - blue to cyan */}
      <path
        d="M4 15.5C4 13 6 11 9 11H28C33 11 37 13.5 37 16C37 18.5 33 21 28 21H4V15.5Z"
        fill={`url(#g1${id})`}
      />
      {/* Middle ribbon - cyan to green */}
      <path
        d="M4 24.5C4 22 7 19.5 11 19.5H32C38 19.5 42 22 42 25C42 28 38 30.5 32 30.5H4V24.5Z"
        fill={`url(#g2${id})`}
      />
      {/* Bottom ribbon - green */}
      <path
        d="M4 33.5C4 31 8 28.5 13 28.5H30C34 28.5 37 31 37 33.5C37 36 34 38.5 30 38.5H4V33.5Z"
        fill={`url(#g3${id})`}
      />
    </svg>
  )

  if (variant === "icon") return <div className={className}><Icon id="icon" /></div>

  if (variant === "wordmark") {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Icon id="wm" />
        <div className="flex items-baseline">
          <span className="font-extrabold text-flow-white" style={{ fontSize }}>Flow</span>
          <span className="font-extrabold text-gradient" style={{ fontSize }}>OS</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <Icon id="full" />
      <div className="flex flex-col">
        <div className="flex items-baseline">
          <span className="font-extrabold text-flow-white tracking-tight" style={{ fontSize }}>Flow</span>
          <span className="font-extrabold text-gradient tracking-tight" style={{ fontSize }}>OS</span>
        </div>
        {size >= 28 && (
          <div className="flex items-center gap-2 mt-0.5">
            <div className="h-px flex-1 bg-flow-green/40" />
            <span className="text-[0.42em] font-medium uppercase tracking-[0.35em] text-flow-gray" style={{ fontSize: fontSize * 0.38 }}>
              Food Service OS
            </span>
            <div className="h-px flex-1 bg-flow-green/40" />
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
        <linearGradient id="fg1" x1="8" y1="11" x2="37" y2="11" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1E7BFF" />
          <stop offset="100%" stopColor="#17D7FF" />
        </linearGradient>
        <linearGradient id="fg2" x1="8" y1="20" x2="42" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#17D7FF" />
          <stop offset="100%" stopColor="#00D98B" />
        </linearGradient>
        <linearGradient id="fg3" x1="8" y1="29" x2="37" y2="29" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00D98B" />
          <stop offset="100%" stopColor="#00D98B" />
        </linearGradient>
      </defs>
      <path d="M8 15.5C8 13 10 11 13 11H28C33 11 37 13.5 37 16C37 18.5 33 21 28 21H8V15.5Z" fill="url(#fg1)" />
      <path d="M8 24.5C8 22 11 19.5 15 19.5H32C38 19.5 42 22 42 25C42 28 38 30.5 32 30.5H8V24.5Z" fill="url(#fg2)" />
      <path d="M8 33.5C8 31 12 28.5 17 28.5H30C34 28.5 37 31 37 33.5C37 36 34 38.5 30 38.5H8V33.5Z" fill="url(#fg3)" />
    </svg>
  )
}
