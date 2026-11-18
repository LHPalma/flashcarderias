# Flashcards

App de flashcards com repetição espaçada, vários decks e progresso salvo no aparelho. Funciona offline e pode ser instalado no celular (PWA). Visual de LCD de matriz de pontos, com quatro temas (âmbar é o padrão).

App publicado em https://lhpalma.github.io/flashcarderias/

## Comandos

```bash
npm install
npm run dev      # servidor de desenvolvimento
npm test         # testes unitários (SRS, importador do Anki, estatísticas)
npm run build    # type-check + build de produção em dist/
npm run preview  # serve o build (o service worker só existe aqui, não no dev)
```

## Como funciona

- **Repetição espaçada** (`src/srs.ts`): inspirada no SM-2/Anki. Quatro respostas (Errei, Difícil, Bom, Fácil); cada botão mostra o prazo da próxima revisão.
- **Dados** (`src/db.ts`): IndexedDB via Dexie, tudo no aparelho. Backup e restauração em JSON nos Ajustes.
- **Anki**: importa e exporta `.txt` com campos separados por tab (`src/anki.ts`).
- **Progresso** (`src/stats.ts`): mapa de calor de 22 semanas, sequência de dias e métricas, calculados a partir do histórico de revisões.
- **Estilo**: Tailwind CSS v4. Os temas são variáveis CSS por `data-theme` em `src/styles.css`, expostas como cores do Tailwind (`bg-panel`, `text-pt`, `border-ink`…), então trocar de tema não exige classes novas. As teclas de resposta (`g1` a `g4`) têm cores fixas em todos os temas. Peças repetidas (teclas, painéis, caixas, rótulos) ficam em `src/components/ui.tsx`.
- **Fontes** locais (`@fontsource`), para funcionar offline.

## Instalar no celular

O navegador só oferece a instalação quando o app é servido por **HTTPS**. Publique a pasta `dist/` em qualquer hospedagem estática (GitHub Pages, Netlify, Cloudflare Pages…) e abra o endereço no celular:

- **Android (Chrome):** Ajustes do app → "Instalar no celular", ou menu do navegador → "Instalar app".
- **iPhone (Safari):** Compartilhar → "Adicionar à Tela de Início".

O roteamento usa `#` (HashRouter), então não precisa configurar redirecionamentos no servidor.
