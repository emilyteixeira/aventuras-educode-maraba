# CLAUDE.md — Aventuras do Edu

Leia primeiro: `docs/HANDOVER.md`, depois `docs/PRD.md`.

## Regras do projeto
- Idioma: português do Brasil em docs, commits e interface.
- Stack obrigatória (declarada pela Emily em 16/10/2026): **TypeScript + React** no front, **Python** no back, banco **SQL**. Não sugira trocar a stack nem a arquitetura sem pedido explícito.
- Papel esperado: tech lead. Ofereça **opções de decisão**, não imponha.
- Estilo: conciso, fatos antes de explicação, valores concretos (portas, limites). Sem blocos de código extensos em respostas de chat.
- Este projeto é **anexo do EduCode**, separado do TCC. Não misturar escopos nem repositórios.

## Restrições de produto
- Estudantes de 11–12 anos: dados mínimos. O que aparece para outros alunos é só apelido + Edu. E-mail nunca é exibido.
- Pontuação, gabarito e frase-chave só no servidor.
- Acessibilidade WCAG 2.2 AA; respeitar `prefers-reduced-motion`; áudio nunca toca sem ação do usuário.
- O jogo nunca pode depender do projetor.
- Áudio e arte só com licença registrada em `CREDITS.md`.

## Ao terminar uma sessão
1. Atualize `docs/HANDOVER.md` (próximo passo, decisões, problemas resolvidos).
2. Crie/atualize `docs/sessoes/AAAA-MM-DD.md`.
3. Se o usuário citar algo que contradiga o handover, avise antes de seguir.
4. Não reintroduza bugs listados em "Problemas resolvidos".
