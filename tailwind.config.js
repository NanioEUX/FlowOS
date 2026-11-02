/** @type {import('tailwindcss').Config} */
module.exports = {
  // F8D-026: `dark:` passa a responder à classe `dark` no <html> (controlada
  // pelo app), não à preferência do SO — antes o dashboard claro ficava com
  // componentes escuros num celular em dark mode.
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        flow: {
          bg: "#07101D",
          surface: "#081A3A",
          card: "#0E1B2B",
          blue: "#1E7BFF",
          cyan: "#17D7FF",
          green: "#00D98B",
          white: "#FFFFFF",
          gray: "#A7B2C2",
          muted: "#6C7A8E",
        },
        // F8C-013: paleta do PDV/mesa que vivia em hex hardcoded dentro do
        // className (69 ocorrências em `caixa-page.tsx`). Tokens com os MESMOS
        // valores — a troca é visualmente idêntica, só centraliza a paleta.
        pdv: {
          bg: "#0d2137", // fundo principal da tela
          card: "#1a3a5c", // cards, header e abas
          "card-alt": "#162e4a", // card/hover de superfície
          elevated: "#0f2942", // superfície elevada (cards sobre card)
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "24px",
        btn: "14px",
        input: "12px",
        dashboard: "20px",
      },
      boxShadow: {
        flow: "0 10px 40px rgba(0,0,0,.35)",
        glow: "0 0 30px rgba(0,217,139,.15)",
        "glow-blue": "0 0 30px rgba(30,123,255,.2)",
      },
    },
  },
  plugins: [],
}
