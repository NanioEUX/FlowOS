#!/usr/bin/env bash
# Fase 6.4/6.6 — Headers de segurança, SEO e metadados do cardápio público
#
# Alvos: F6A-018 (nenhum header de segurança), F6B-021 (sem robots/sitemap/canonical/JSON-LD),
#        F6B-022 (peso da rota), + verificação de XSS refletido no HTML (F6A-015 é DOM, ver
#        6-05-roteiro-xss-ux.md).
#
# NÃO EXECUTADO durante a auditoria (regra 4/2.5). Lê apenas metadados via HTTP.
#
# Esperado: CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, HSTS presentes;
#           /robots.txt e /sitemap.xml respondendo 200.
# Obtido  : NÃO EXECUTADO.

set -uo pipefail
BASE="${BASE_URL:-http://localhost:3000}"
SLUG="${SLUG:?defina SLUG (loja alvo)}"
passou=0; falhou=0

echo "=== 1. Headers de segurança em /$SLUG ==="
curl -sI "$BASE/$SLUG" -o /tmp/f6-h.txt
for h in "content-security-policy" "x-frame-options" "x-content-type-options" "referrer-policy" "strict-transport-security"; do
  if grep -qi "^$h:" /tmp/f6-h.txt; then
    echo "OK   — $h"; passou=$((passou+1))
  else
    echo "FALHA — $h ausente"; falhou=$((falhou+1))
  fi
done

echo
echo "=== 2. Cache — mistura de dados entre lojas ==="
grep -i "^cache-control:" /tmp/f6-h.txt || echo "        (sem Cache-Control na página de loja)"

echo
echo "=== 3. SEO ==="
for u in "/robots.txt" "/sitemap.xml" "/$SLUG" ; do
  codigo=$(curl -s -o /tmp/f6-seo.html -w '%{http_code}' "$BASE$u")
  echo "GET $u -> $codigo"
  if [ "$u" = "/$SLUG" ]; then
    grep -Eio '<title>[^<]*</title>' /tmp/f6-seo.html | sed 's/^/        /'
    grep -Eio 'property="og:image"[^>]*' /tmp/f6-seo.html | sed 's/^/        /'
    grep -Eio 'rel="canonical"[^>]*' /tmp/f6-seo.html | sed 's/^/        /'
    grep -Eio 'application/ld\+json' /tmp/f6-seo.html | sed 's/^/        JSON-LD: /'
    if grep -qi 'application/ld+json' /tmp/f6-seo.html; then
      echo "        JSON-LD presente"; passou=$((passou+1))
    else
      echo "        FALHA — sem JSON-LD (Restaurant schema.org)"; falhou=$((falhou+1))
    fi
    if grep -qi 'rel="canonical"' /tmp/f6-seo.html; then
      echo "        canonical presente"; passou=$((passou+1))
    else
      echo "        FALHA — sem canonical"; falhou=$((falhou+1))
    fi
  fi
done

echo
echo "=== 4. Peso do HTML e do JS da rota do cardápio ==="
curl -s "$BASE/$SLUG" -o /tmp/f6-peso.html
echo "HTML: $(wc -c < /tmp/f6-peso.html) bytes"
grep -Eo 'src="/_next/static/chunks/app/\[slug\][^"]+"' /tmp/f6-peso.html | sed 's/src="//;s/"//' | while read -r c; do
  tam=$(curl -s -o /dev/null -w '%{size_download}' "$BASE$c")
  echo "chunk $c -> $tam bytes"
done
echo "        (meta esperada F6B-022: chunk da rota ~266.588 B; menu-page.tsx = 7.360 linhas)"

echo
echo "=== 5. <img> sem otimização ==="
echo "total <img> no HTML: $(grep -o '<img' /tmp/f6-peso.html | wc -l | tr -d ' ') (F6B-022: 13 no fonte, 0 next/image)"

echo
echo "Resultado: $passou OK · $falhou FALHA"
echo "Obtido: NÃO EXECUTADO"
