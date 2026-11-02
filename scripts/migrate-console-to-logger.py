#!/usr/bin/env python3
"""
F4A-018 — migração em lote de `console.error` para o logger estruturado.

Converte apenas padrões uniformes de catch (`console.error([msg], error)`) em
`logger.error(scope, msg, { requestId, error })`. Qualquer coisa fora do padrão
é deixada intacta (o script é conservador por design).

ESTADO: a migração já foi aplicada no código (out/2026). O script continua no
repositório como referência do padrão usado e para re-aplicar em rotas novas —
rode sempre com `git diff` depois, e confira `npx tsc --noEmit` + `npx vitest run`.

Os `console.log` de diagnóstico (info) foram migrados à mão, caso a caso, por
causarem PII em claro (telefone, nome, payload do push, token da Meta).
"""
import re
import sys
from pathlib import Path

ROOT = Path("src/app/api")

# padrões: (regex, scope)
PATTERNS = [
    (re.compile(r'console\.error\(error\)'), None),
    (re.compile(r'console\.error\("\[(?P<tag>[^\]]+)\]", error\)'), "tag"),
    (re.compile(r'console\.error\("\[(?P<tag>[^\]]+)\] Error:", error\.message\)'), "tag"),
    (re.compile(r'console\.error\("(?P<msg>[^"]+):", error\)'), "msg"),
    (re.compile(r'console\.error\("(?P<msg>[^"]+)", error\)'), "msg"),
]


def scope_from_path(path: Path) -> str:
    rel = path.relative_to(ROOT).as_posix()
    rel = rel.replace("/route.ts", "")
    rel = rel.replace("/[id]", "")
    rel = rel.replace("/[slug]", "")
    rel = rel.replace("/[token]", "")
    rel = rel.replace("/[number]", "")
    return rel or "api"


def handler_params(text: str):
    return set(re.findall(r"export async function (?:GET|POST|PATCH|PUT|DELETE)\(\s*(\w+)\s*:", text))


def last_import_end(lines):
    end = 0
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.startswith("import "):
            # import de uma linha
            if re.search(r'from\s+"[^"]+"\s*;?\s*$', line):
                end = i + 1
            else:
                # bloco multilinha: procura o fechamento
                j = i
                while j < len(lines) and not re.search(r'from\s+"[^"]+"\s*;?\s*$', lines[j]):
                    j += 1
                end = j + 1
            i = end
            continue
        i += 1
    return end


def convert(path: Path) -> int:
    text = path.read_text()
    original = text
    params = handler_params(text)
    param = "req" if "req" in params else ("request" if "request" in params else None)

    for regex, kind in PATTERNS:
        def repl(m):
            scope = scope_from_path(path)
            msg = "falha na operação"
            if kind == "tag":
                scope = re.sub(r"[^a-z0-9]+", "-", m.group("tag").lower()).strip("-") or scope
                msg = f"falha em {m.group('tag')}"
            elif kind == "msg":
                msg = m.group("msg").strip().rstrip(":")
            ctx = []
            if param:
                ctx.append(f"requestId: getRequestId({param})")
            ctx.append("error: (error as any)?.message")
            return f'logger.error("{scope}", "{msg}", {{ {", ".join(ctx)} }})'

        text = regex.sub(repl, text)

    if text == original:
        return 0

    if 'from "@/lib/logger"' not in text:
        lines = text.split("\n")
        pos = last_import_end(lines)
        lines.insert(pos, 'import { getRequestId, logger } from "@/lib/logger"')
        text = "\n".join(lines)

    path.write_text(text)
    return 1


def main():
    changed = 0
    files = 0
    for path in sorted(ROOT.rglob("route.ts")):
        if "__tests__" in path.parts:
            continue
        n = convert(path)
        if n:
            changed += 1
            files += 1
    print(f"convertidos: {changed} arquivos")


if __name__ == "__main__":
    main()
