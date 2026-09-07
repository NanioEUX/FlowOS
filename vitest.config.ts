import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: [
        "src/lib/integrations/nine-nine.ts",
        "src/app/api/delivery/dispatch-99/**",
        "src/app/api/delivery/poll-99/**",
        "src/app/api/delivery/calculate/**",
        "src/app/api/webhooks/99/**",
        "src/app/api/establishments/[id]/delivery-config/**",
      ],
    },
  },
})
