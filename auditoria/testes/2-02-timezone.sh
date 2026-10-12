#!/usr/bin/env bash
# Fase 2 — Fuso horário do "dia" (F2-004)
# NÃO EXECUTADO. Rodar entre 21h00 e 23h59 horário de Brasília.
#
# Esperado: um pedido criado agora aparece em todayOrders do /api/dashboard.
#           Com o bug: contado como "amanhã" (o servidor está em UTC).
# Obtido: NÃO EXECUTADO.
set -uo pipefail
BASE="${BASE_URL:-http://localhost:3000}"
ESTAB="${ESTAB_ID:?defina ESTAB_ID}"

echo "agora (UTC)  : $(date -u '+%Y-%m-%d %H:%M:%S')"
echo "agora (local): $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "dia segundo o servidor (UTC): $(date -u '+%Y-%m-%d')"
echo "dia real em Sao Paulo       : $(TZ=America/Sao_Paulo date '+%Y-%m-%d')"
echo
curl -s "$BASE/api/dashboard?establishmentId=$ESTAB" \
  | python3 -c 'import sys,json;d=json.load(sys.stdin);print("dashboard.recentOrders[0].createdAt =", (d.get("recentOrders") or [{}])[0].get("createdAt"))' 2>/dev/null \
  || echo "(sem dados ou rota exige auth)"
echo ">> Se as contagens de 'hoje' não baterem com a data de Brasília, F2-004 confirmado."
echo ">> Obtido: NÃO EXECUTADO"
