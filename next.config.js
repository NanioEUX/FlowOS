/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  // F8A-008: id do build inlined no front. O service worker é registrado como
  // /sw.js?v=<id>, então cada build gera uma URL nova — o browser busca um SW
  // novo, o cache antigo é purged e o app avisa que há versão nova. Não existe
  // mais número de versão hardcoded para alguém lembrar de bumpar.
  env: {
    NEXT_PUBLIC_BUILD_ID:
      process.env.NEXT_PUBLIC_BUILD_ID || `build-${Date.now().toString(36)}`,
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  // Headers de segurança (auditoria F6A/F6A-018) — conjunto conservador que não
  // quebra o cardápio/PWA/PDV.
  // CSP montada a partir de inventário estático dos recursos do browser (14/10):
  //  - script: só self + inline (Next RSC/hidratação) + scripts da Vercel;
  //  - connect: self + viacep.com.br (única chamada externa do browser);
  //  - img: self/data/blob + https: (Supabase Storage é externo);
  //  - frame: self + https: (iframe do paymentLink no tracking);
  //  - worker: self/blob (service worker /sw.js).
  // Se houver script injetado via dashboard da Vercel, adicionar o domínio aqui.
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://viacep.com.br",
      "frame-src 'self' https:",
      "frame-ancestors 'self'",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "media-src 'self' data: blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join("; ")

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
        ],
      },
    ]
  },
}

module.exports = nextConfig
