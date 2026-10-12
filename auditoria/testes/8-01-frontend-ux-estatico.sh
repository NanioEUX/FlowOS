#!/usr/bin/env bash
# Fase 8 — Frontend/UX/Acessibilidade: testes ESTÁTICOS (grep no código). Seguros: não tocam rede/banco.
# Uso: bash 8-01-frontend-ux-estatico.sh   (rodar na raiz do projeto)
# Semântica: [CONFIRMADO] = evidência do achado encontrada; [REVER] = guarda/ausência inesperada.
set -u
OK=0; REV=0
confirmar() { # confirmar "descrição" "arquivo" "padrão"
  local desc="$1" arq="$2" pad="$3"
  if [ ! -e "$arq" ]; then echo "[REVER] $desc — caminho não encontrado: $arq"; REV=$((REV+1)); return; fi
  if grep -rqF -- "$pad" "$arq"; then echo "[CONFIRMADO] $desc"; OK=$((OK+1));
  else echo "[REVER] $desc — padrão ausente em $arq: $pad"; REV=$((REV+1)); fi
}
ausente() { # ausente "descrição" "arquivo" "padrão que NÃO deve existir"
  local desc="$1" arq="$2" pad="$3"
  if [ ! -e "$arq" ]; then echo "[REVER] $desc — caminho não encontrado: $arq"; REV=$((REV+1)); return; fi
  if grep -rqF -- "$pad" "$arq"; then echo "[REVER] $desc — padrão INESPERADO presente em $arq"; REV=$((REV+1));
  else echo "[CONFIRMADO] $desc"; OK=$((OK+1)); fi
}
contar() { # contar "descrição" "n" "regra" "esperado"
  local desc="$1" n="$2" regra="$3" esperado="$4"
  if [ "$regra" = "igual" ] && [ "$n" -eq "$esperado" ]; then echo "[CONFIRMADO] $desc (= $n)"; OK=$((OK+1));
  elif [ "$regra" = "menor_que" ] && [ "$n" -lt "$esperado" ]; then echo "[CONFIRMADO] $desc (< $esperado, veio $n)"; OK=$((OK+1));
  elif [ "$regra" = "maior_que" ] && [ "$n" -gt "$esperado" ]; then echo "[CONFIRMADO] $desc (> $esperado, veio $n)"; OK=$((OK+1));
  else echo "[REVER] $desc — veio $n, esperado $regra $esperado"; REV=$((REV+1)); fi
}
ausente_re() { # ausente_re "descrição" "diretório" "regex extended"
  local desc="$1" dir="$2" re="$3"
  if [ ! -e "$dir" ]; then echo "[REVER] $desc — caminho não encontrado: $dir"; REV=$((REV+1)); return; fi
  if grep -rnE -- "$re" "$dir" >/dev/null 2>&1; then echo "[REVER] $desc — regex INESPERADA presente em $dir"; REV=$((REV+1));
  else echo "[CONFIRMADO] $desc"; OK=$((OK+1)); fi
}
nao_existe() { # nao_existe "descrição" "caminho"
  local desc="$1" arq="$2"
  if [ -e "$arq" ]; then echo "[REVER] $desc — $arq EXISTE"; REV=$((REV+1));
  else echo "[CONFIRMADO] $desc"; OK=$((OK+1)); fi
}

echo "== Fase 8 — frontend/UX/acessibilidade (estatico) =="

# 8.1 Responsividade
confirmar "F8A-001 PDV carrinho fixo w-80" "src/app/caixa/caixa-page.tsx" 'flex w-80 flex-col'
contar "F8A-002 KDS sem nenhum breakpoint" "$(grep -cE '\b(sm|md|lg|xl|2xl):' 'src/app/kds/(auth)/screen/page.tsx')" igual 0
contar "F8A-002 KDS com 14x text-[10px]" "$(grep -c 'text-\[10px\]' 'src/app/kds/(auth)/screen/page.tsx')" maior_que 10
confirmar "F8A-014 manifest trava portrait" "public/manifest.json" '"orientation": "portrait"'
contar "F8A-015 caixa sem safe-area" "$(grep -c 'safe-area' src/app/caixa/caixa-page.tsx)" igual 0

# 8.2 Estados / confirmações
confirmar "F8B-001 caixa loadData com Promise.all sem try" "src/app/caixa/caixa-page.tsx" "const results = await Promise.all(promises)"
confirmar "F8B-005 layout catch redireciona para login" "src/app/dashboard/(auth)/layout.tsx" '.catch(() => router.replace("/login"))'
contar "F8B-006 nenhum navigator.onLine em src" "$(grep -rn 'navigator.onLine' src --include='*.ts' --include='*.tsx' 2>/dev/null | wc -l | tr -d ' ')" igual 0
contar "F8B-003 nenhum error.tsx no App Router" "$(find src/app -name 'error.tsx' 2>/dev/null | wc -l | tr -d ' ')" igual 0
contar "F8B-003 nenhum not-found.tsx no App Router" "$(find src/app -name 'not-found.tsx' 2>/dev/null | wc -l | tr -d ' ')" igual 0
confirmar "F8B-010 fechar caixa sem res.ok no fluxo" "src/app/caixa/caixa-page.tsx" 'toast("Caixa fechado com sucesso'

# 8.3 Formulários / re-entrância
confirmar "F8C-001 close-table disabled só cobre split" "src/app/caixa/caixa-page.tsx" 'disabled={closeTableMode === "split"'
confirmar "F8C-003 abrir caixa sem disabled" "src/app/caixa/caixa-page.tsx" 'onClick={openCashRegister}'
confirmar "F8C-003 fechar caixa sem disabled" "src/app/caixa/caixa-page.tsx" 'onClick={closeCashRegister}'
confirmar "F8C-005 ConfirmDialog sem disabled no Confirmar" "src/components/confirm-dialog.tsx" 'onClick={onConfirm}'
contar "F8C-005 nenhum disabled no ConfirmDialog" "$(grep -c 'disabled' src/components/confirm-dialog.tsx)" igual 0
confirmar "F8C-007 OTP visivel no menu-page" "src/app/[slug]/menu-page.tsx" "WhatsApp não entregou"
confirmar "F8C-008 printReceiptPopup interpola item.name" "src/app/caixa/caixa-page.tsx" '${item.name}'
contar "F8C-019 nenhum scanner/barcode em src" "$(grep -rniE 'scanner|barcode|onScan' src --include='*.ts' --include='*.tsx' 2>/dev/null | wc -l | tr -d ' ')" igual 0

# 8.5 Acessibilidade
contar "F8D-003 viewport maximumScale 1" "$(grep -c 'maximumScale: 1' src/app/layout.tsx)" igual 1
contar "F8D-003 viewport userScalable false" "$(grep -c 'userScalable: false' src/app/layout.tsx)" igual 1
contar "F8D-004 nenhum role= ou aria-modal em src" "$(grep -rn 'role=\|aria-modal' src --include='*.tsx' 2>/dev/null | wc -l | tr -d ' ')" igual 0
contar "F8D-010 nenhum skip link" "$(grep -rniE 'skip.?link|pular para' src --include='*.tsx' 2>/dev/null | wc -l | tr -d ' ')" igual 0
contar "F8D-010 apenas 3 main em src/app" "$(grep -rln '<main' src/app --include='*.tsx' 2>/dev/null | wc -l | tr -d ' ')" igual 3
contar "F8D-007 apenas 13 htmlFor em src/app" "$(grep -rn 'htmlFor' src/app --include='*.tsx' 2>/dev/null | wc -l | tr -d ' ')" igual 13
contar "F8D-013 badge-fire sem CSS (globals.css = 0)" "$(grep -c 'badge-fire' src/app/globals.css)" igual 0
contar "F8D-016 focus:outline-none sem ring/border/shadow (menu-page)" "$(grep -n 'focus:outline-none' 'src/app/[slug]/menu-page.tsx' | grep -vc 'ring\|border\|shadow')" maior_que 10
contar "F8D-016 nenhum focus-visible em src" "$(grep -rn 'focus-visible' src --include='*.tsx' 2>/dev/null | wc -l | tr -d ' ')" igual 0

# 8.6 Design system / i18n
contar "F8C-013 caixa-page com 0 <Button do design system" "$(grep -c '<Button' src/app/caixa/caixa-page.tsx)" igual 0
contar "F8C-013 caixa-page com 60+ <button> raw" "$(grep -c '<button' src/app/caixa/caixa-page.tsx)" maior_que 60
contar "F8C-021 nenhuma lib i18n" "$(grep -rniE 'next-intl|i18next|react-intl' package.json src --include='*.json' --include='*.ts' --include='*.tsx' 2>/dev/null | wc -l | tr -d ' ')" igual 0

# 8.7 PWA / atualização
confirmar "F8A-004 sw.js navega clients no activate" "public/sw.js" "client.navigate(client.url)"
confirmar "F8A-004 sw.js skipWaiting no install" "public/sw.js" "self.skipWaiting()"
confirmar "F8A-005 notificação navega primeira janela" "public/sw.js" "clients.find((c) => c.url.includes(self.location.origin))"
nao_existe "F8A-006 sem offline.html" "public/offline.html"
contar "F8A-009 nenhum updatefound/controllerchange em src" "$(grep -rnE 'updatefound|controllerchange|reg\.update' src --include='*.ts' --include='*.tsx' 2>/dev/null | wc -l | tr -d ' ')" igual 0
contar "F8A-010 nenhum schemaVersion/APP_VERSION em src" "$(grep -rnE 'schemaVersion|APP_VERSION' src --include='*.ts' --include='*.tsx' 2>/dev/null | wc -l | tr -d ' ')" igual 0

# 8.8 Rede / sessão
confirmar "F8B-007 kds-login token 24h sem refresh" "src/app/api/auth/kds-login/route.ts" 'expiresIn: "24h"'
confirmar "F8B-008 fetchAuth redirect bruto para login" "src/lib/fetch-auth.ts" 'window.location.href = "/login"'
contar "F8B-009 login sem leitura de querystring/reason" "$(grep -c 'searchParams\|reason' src/app/login/page.tsx)" igual 0

echo
echo "CONFIRMADO=$OK  REVER=$REV"
[ "$REV" -eq 0 ] && echo "RESULTADO: todos os achados estaticos da Fase 8 confirmados no codigo atual." || echo "RESULTADO: revise os itens [REVER]."
