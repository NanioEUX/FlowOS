#!/usr/bin/env bash
# Fase 7.8 — Testes 3, 4 e 5: reuso de código, código de outra pessoa, vazamento
#
# Teste 3: reutilizar código já usado e código expirado.
# Teste 4: pedir código para o número A e tentar validar com a sessão do número B.
# Teste 5: verificar se o código aparece no corpo da resposta, nos logs e na aba Network.
#
# Alvos: F7A-001/F7B-001 (devCode/verifyLink na resposta), F7A-011 (respostas
#        distintas + `remaining`), F7A-015/F7B-008 (sessão = localStorage por slug).
#
# NÃO EXECUTADO durante a auditoria (regra 2.5). NÃO destrutivo: só leitura do
# próprio fluxo de teste (envia 3-4 códigos para números de teste).
#
# Esperado: (3) 400/429 em reuso; (4) 400 — código do A não valida no contexto
#           do B; (5) 200 SEM `devCode` e SEM `verifyLink`.
# Obtido  : NÃO EXECUTADO.

set -uo pipefail
BASE="${BASE_URL:-http://localhost:3000}"
ESTAB="${ESTAB_ID:?defina ESTAB_ID}"
A="${NUMERO_A:-5547999000001}"
B="${NUMERO_B:-5547999000002}"
passou=0; falhou=0

POST () { curl -s -X POST "$BASE/api/verification" -H "Content-Type: application/json" --data "$1"; }
PUT  () { curl -s -X PUT  "$BASE/api/verification" -H "Content-Type: application/json" --data "$1"; }

echo "=== TESTE 5 — o código vaza na resposta? ==="
resp=$(POST "{\"phone\":\"$A\",\"establishmentId\":\"$ESTAB\"}")
echo "$resp" > /tmp/f7-resp.json
if echo "$resp" | grep -qE '"devCode"|"verifyLink"'; then
  echo "FALHA — resposta contém devCode/verifyLink:"
  echo "$resp" | grep -oE '"(devCode|verifyLink)":[^,}]*' | sed 's/^/        /'
  falhou=$((falhou+1))
  CODE=$(echo "$resp" | grep -oE '"devCode":"[0-9]+"' | grep -oE '[0-9]+')
else
  echo "OK — resposta sem código"
  passou=$((passou+1))
  CODE=""
fi

echo
echo "=== TESTE 5b — o código aparece nos logs do servidor? ==="
echo "        (exigir acesso aos logs da Vercel — NÃO VERIFICADO pelo repositório)"
echo "        evidência estática: verification/route.ts:155,260 e whatsapp/meta.ts:100"

echo
echo "=== TESTE 3 — reuso de código usado ==="
if [ -z "$CODE" ]; then
  echo "        sem devCode disponível: ler o código pelo canal oficial do WhatsApp de teste"
  echo "        OU pedir ao responsável pelo código gerado (ambiente de teste)"
else
  echo "        usando o código exposto pela própria resposta de teste 5"
fi
r1=$(PUT "{\"phone\":\"$A\",\"establishmentId\":\"$ESTAB\",\"code\":\"$CODE\"}")
echo "1ª validação: $r1"
r2=$(PUT "{\"phone\":\"$A\",\"establishmentId\":\"$ESTAB\",\"code\":\"$CODE\"}")
echo "2ª validação (mesmo código): $r2"
if echo "$r2" | grep -q '"success":true'; then
  echo "FALHA — código reutilizado"; falhou=$((falhou+1))
else
  echo "OK — reuso recusado"; passou=$((passou+1))
fi

echo
echo "=== TESTE 3b — código expirado (esperar >5 min) ==="
echo "        reenviar após 6 min e tentar validar com o código antigo:"
echo "        esperado 400 'Código expirado ou não encontrado'"

echo
echo "=== TESTE 4 — código do A validado no contexto do B ==="
r=$(PUT "{\"phone\":\"$B\",\"establishmentId\":\"$ESTAB\",\"code\":\"$CODE\"}")
echo "código de A, telefone de B: $r"
if echo "$r" | grep -q '"success":true'; then
  echo "FALHA — código de outro número aceito"; falhou=$((falhou+1))
else
  echo "OK — recusado (código atrelado ao customerId do A)"; passou=$((passou+1))
fi

echo
echo "=== TESTE 4b — diferença de resposta (enumeração) ==="
echo "  número sem cadastro : $(PUT "{\"phone\":\"5547000000000\",\"establishmentId\":\"$ESTAB\",\"code\":\"000000\"}" | head -c 120)"
echo "  número com cadastro : $(PUT "{\"phone\":\"$A\",\"establishmentId\":\"$ESTAB\",\"code\":\"000000\"}" | head -c 120)"
echo "        (diferença 404 vs 400 = F7A-017; o ideal é resposta única 202)"

echo
echo "Resultado: $passou OK · $falhou FALHA"
echo "Obtido: NÃO EXECUTADO"
