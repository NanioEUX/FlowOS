#!/usr/bin/env bash
# Fase 7.8 — Teste 1 e 2: força bruta e abuso do envio de OTP
#
# Teste 1: 1.000 códigos seguidos para o MESMO número.
# Teste 2: 20 envios em 1 minuto para o mesmo número e para números DIFERENTES
#          a partir do MESMO IP.
#
# Alvos: F7A-009/F7B-011 (rate limit só por número, nenhum por IP),
#        F7A-018 (cria Customer para qualquer número), F7A-012 (sem cota Meta),
#        F7A-021 (BYPASS_PHONES isento dos limites).
#
# NÃO EXECUTADO durante a auditoria (regra 2.5: DATABASE_URL = produção).
# => DESTRUTIVO/CARO: envia mensagens reais via API da Meta e pode gastar cota
#    ou rebaixar o quality rating do número da loja. RODAR SÓ EM AMBIENTE DE TESTE
#    com loja própria e número descartável.
#
# Esperado (Teste 1): 429 a partir de 10/dia (5/h, cooldown 60 s) — nunca 1.000 × 200.
# Esperado (Teste 2): 429 no 2º envio do mesmo número; e limite também por IP
#                     (hoje NÃO existe → espera-se que 20 números diferentes passem).
# Obtido: NÃO EXECUTADO.

set -uo pipefail
BASE="${BASE_URL:-http://localhost:3000}"
ESTAB="${ESTAB_ID:?defina ESTAB_ID}"
N_LOJA="${NUMERO_LOJA:-5547999999999}"      # número da VÍTIMA/destino de teste
N_TESTE_PREFIXO="${N_TESTE_PREFIXO:-55478888}"  # variação para números sintéticos

enviar () { # $1 = telefone
  curl -s -o /tmp/f7-env.json -w '%{http_code}' -X POST "$BASE/api/verification" \
    -H "Content-Type: application/json" \
    -H "Content-Type: application/json" \
    --data "{\"phone\":\"$1\",\"establishmentId\":\"$ESTAB\"}"
}

echo "=== TESTE 1 — 1.000 envios para o MESMO número ==="
echo "(esperado: 200 no 1º, 429 do 2º em diante por cooldown/5h/10d)"
b200=0; b429=0; outro=0
for i in $(seq 1 1000); do
  c=$(enviar "$N_LOJA")
  case "$c" in
    200) b200=$((b200+1)) ;;
    429) b429=$((b429+1)) ;;
    *)   outro=$((outro+1)); echo "  inesperado [$c] na tentativa $i" ;;
  esac
  [ $((i % 100)) -eq 0 ] && echo "  ...$i/1000 (200=$b200 429=$b429 outros=$outro)"
done
echo "Resultado Teste 1: 200=$b200 · 429=$b429 · outros=$outro"
if [ "$b200" -le 12 ]; then
  echo "OK — limite diário/horário contido (<=12 aceitos de 1.000)"
else
  echo "FALHA — $b200 envios aceitos para o mesmo número"
fi

echo
echo "=== TESTE 2a — 20 envios em <1 minuto para o MESMO número ==="
r200=0; r429=0
for i in $(seq 1 20); do
  c=$(enviar "$N_LOJA")
  [ "$c" = "200" ] && r200=$((r200+1))
  [ "$c" = "429" ] && r429=$((r429+1))
done
echo "mesmo número: 200=$r200 · 429=$r429 (esperado: 429 em 19-20 de 20)"
[ "$r429" -ge 19 ] && echo "OK" || echo "FALHA — cooldown por número não segurou"

echo
echo "=== TESTE 2b — 20 envios em <1 minuto para NÚMEROS DIFERENTES do MESMO IP ==="
echo "(aqui está o defeito esperado: não existe rate limit por IP)"
r200=0; r429=0
for i in $(seq 1 20); do
  c=$(enviar "${N_TESTE_PREFIXO}0${i}")
  [ "$c" = "200" ] && r200=$((r200+1))
  [ "$c" = "429" ] && r429=$((r429+1))
done
echo "números distintos: 200=$r200 · 429=$r429"
if [ "$r200" -ge 18 ]; then
  echo "FALHA — $r200/20 aceitos do mesmo IP (F7A-009: sem teto por IP/dispositivo/loja)"
else
  echo "OK — algum teto por IP/loja existiu"
fi

echo
echo "=== Testes restantes da 7.8 → 7-02 e 7-03 ==="
echo "Obtido: NÃO EXECUTADO"
