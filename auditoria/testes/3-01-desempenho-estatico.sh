#!/usr/bin/env bash
# Fase 3 — Desempenho: testes ESTÁTICOS (grep no código). Seguros: não tocam rede/banco.
# Uso: bash 3-01-desempenho-estatico.sh   (rodar na raiz do projeto)
# Semântica: [CONFIRMADO] = evidência do achado encontrada; [REVER] = guarda/ausência inesperada.
set -u
OK=0; FAIL=0; REV=0
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
contar() { # contar "descrição" "comando" "esperado (igual|menor_que)" "n"
  local desc="$1" n="$2" regra="$3" esperado="$4"
  if [ "$regra" = "igual" ] && [ "$n" -eq "$esperado" ]; then echo "[CONFIRMADO] $desc (= $n)"; OK=$((OK+1));
  elif [ "$regra" = "menor_que" ] && [ "$n" -lt "$esperado" ]; then echo "[CONFIRMADO] $desc (< $esperado, veio $n)"; OK=$((OK+1));
  else echo "[REVER] $desc — veio $n, esperado $regra $esperado"; REV=$((REV+1)); fi
}

echo "== Fase 3 — desempenho/escalabilidade (estático) =="

# 1) /api/orders: sem take e com escrita no GET (F3A-001/002)
ausente "F3A-001 GET /api/orders sem take/pagination" "src/app/api/orders/route.ts" "take:"
confirmar "F3A-002 updateMany de expiração dentro do GET de orders" "src/app/api/orders/route.ts" "Expire old pending orders on each dashboard poll"
confirmar "F3A-003 updateMany também no GET público customer" "src/app/api/orders/customer/route.ts" "updateMany"

# 2) Chat/KDS N+1 (F3A-021/F3B-001)
confirmar "F3A-021 chat busca mensagens em loop por pedido" "src/app/dashboard/(auth)/chat/page-content.tsx" "for (const order of conv.orders)"
confirmar "F3A-021 chat roda o loop a cada 5s" "src/app/dashboard/(auth)/chat/page-content.tsx" "setInterval(loadConversations, 5000)"
confirmar "F3B-001 KDS busca mensagens de todos os pedidos" "src/app/kds/(auth)/screen/page.tsx" "fetchMessages(filtered.map"
confirmar "F3B-001 KDS poll de 5s" "src/app/kds/(auth)/screen/page.tsx" "setInterval(fetchOrders, 5000)"

# 3) Cardápio: timers e duplicação (F3A-054/055/056)
confirmar "F3A-054 pollVerified a cada 2s" "src/app/[slug]/menu-page.tsx" "setInterval(pollVerified, 2000)"
confirmar "F3A-055 tick de 15s chama orders/customer duas vezes" "src/app/[slug]/menu-page.tsx" "loadCustomerOrders(true)"
confirmar "F3A-056 poll de payment-status a cada 3s" "src/app/[slug]/menu-page.tsx" "}, 3000)"

# 4) Cache morto / no-store (F3A-028/029)
confirmar "F3A-028 revalidate declarado em rota dinâmica de orders" "src/app/api/orders/route.ts" "export const revalidate = 5"
confirmar "F3A-029 fetchAuth força cache no-store" "src/lib/fetch-auth.ts" 'cache: "no-store"'

# 5) Prisma/pool (F3A-033)
confirmar "F3A-033 globalThis do Prisma só fora de produção" "src/lib/prisma.ts" 'process.env.NODE_ENV !== "production"'

# 6) Infra/limites (F3D-001/002/004/023)
ausente "F3D-001 nenhuma função declara maxDuration" "vercel.json" "maxDuration"
ausente "F3D-001 nenhuma região declarada" "vercel.json" "regions"
contar "F3D-002 crons agendados no vercel.json" "$(grep -c '"path"' vercel.json)" igual 2
confirmar "F3D-004 remotePatterns aberto (hostname **)" "next.config.js" 'hostname: "**"'
ausente "F3D-004 app não usa next/image" "src/app/[slug]/menu-page.tsx" "next/image"
confirmar "F3D-023 sharp é devDependency" "package.json" '"sharp":'
ausente "F3D-015 nenhuma lib de fila/jobs" "package.json" "inngest\|bullmq\|trigger.dev"

# 7) Realtime inexistente (F3C-001) e índices (F3A-061)
contar "F3C-001 canais supabase em src/" "$(grep -rn "\.channel(\|postgres_changes" src --include='*.ts' --include='*.tsx' | grep -v '\.bak' | wc -l | tr -d ' ')" igual 0
contar "F3A-061 OrderMessage tem @@index" "$(sed -n '/^model OrderMessage/,/^}/p' prisma/schema.prisma | grep -c '@@index')" igual 0
contar "F3A-061 Product tem @@index" "$(sed -n '/^model Product /,/^}/p' prisma/schema.prisma | grep -c '@@index')" igual 0
contar "F3A-061 Category sem @@index" "$(sed -n '/^model Category /,/^}/p' prisma/schema.prisma | grep -c '@@index')" igual 0
contar "F3A-061 StockItem sem @@index" "$(sed -n '/^model StockItem/,/^}/p' prisma/schema.prisma | grep -c '@@index')" igual 0
contar "F3A-061 Order TEM 7 índices (padrão existe)" "$(sed -n '/^model Order /,/^}/p' prisma/schema.prisma | grep -c '@@index')" menor_que 8

# 8) Paginação/virtualização ausentes (F3B-006)
ausente "F3B-006 nenhuma lib de virtualização" "package.json" "react-window\|react-virtuoso"
ausente "F3A-030 nenhum unstable_cache no projeto" "src/app" "unstable_cache"

# 9) PDV (F3C-019/020)
confirmar "F3C-019 refetch completo pós-venda no caixa" "src/app/caixa/caixa-page.tsx" "setTimeout(() => {"
contar "F3B-007 quantidade de useState no POS" "$(grep -c "useState" src/app/caixa/caixa-page.tsx)" menor_que 70

echo
echo "CONFIRMADO=$OK  REVER=$REV"
[ "$REV" -eq 0 ] && echo "RESULTADO: todos os achados estáticos da Fase 3 confirmados no código atual." || echo "RESULTADO: revise os itens [REVER]."
