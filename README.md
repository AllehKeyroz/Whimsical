# KDS FLUX

Plataforma de **boards, fluxogramas, mapas mentais e diagramas** da KDS, feita com React + TypeScript + SVG puro. Roda no navegador, salva em IndexedDB com sincronização no Supabase, exporta SVG/PNG/PDF e tem colaboração em tempo real por sala.

Cada conta tem sua própria **organização/empresa/equipe**, exibida no workspace e personalizável no painel Nuvem.

## Stack

- **React 18** + **TypeScript** + **Vite 5**
- **Zustand** para estado do board
- **SVG puro** para renderização (exportável)
- **Lucide** com 2.300+ ícones + emojis
- **Mermaid** para colar diagramas direto no canvas
- **@dagrejs/dagre** para auto-layout
- **IndexedDB** com fallback para `localStorage`
- **Vitest** + **jsdom** para testes
- **WebSocket** opcional (`ws`) para colaboração entre dispositivos

## Funcionalidades

### Workspace, sidebar e explorador de arquivos
- Homepage estilo workspace: sidebar, breadcrumb, cards de ação, estado vazio com atalhos, promo de instalação e botões flutuantes.
- **Sidebar persistente** no dashboard e no board, com Recentes, Privado, Equipes, pastas e árvore de boards (explorador de arquivos).
- Pastas com criação, remoção e movimentação de boards entre pastas.
- **Lista de pastas e boards** com colunas Nome, Criado, Por, Modificado e Por, além de alternância **grade/lista**.
- Board view com **barra de ferramentas vertical flutuante** e barra inferior de undo/redo, layout, zoom e ajuda.
- Topbar com breadcrumb, título editável, favorito, presença, compartilhar, apresentar, comentários, busca, ícones, tema e ajuda.

### Ícones
- **2.346 ícones Lucide** com busca, categorias, cor, tamanho e carregamento sob demanda.
- **Marcas & Cloud:** 147 logos (Simple Icons) + 316 ícones AWS + 636 Azure + 45 Google Cloud + 39 Kubernetes, carregados sob demanda e preservando as cores oficiais.
- **Mapa mental:** `Tab` cria um nó filho conectado, `Enter` cria um nó irmão e `F2`/duplo clique edita o texto.
- Aba de **emojis** por categoria + campo para colar qualquer emoji.
- Ícones são objetos nativos do board: dá para mover, redimensionar, rotacionar, agrupar, conectar, comentar, colorir e exportar.
- Exportação SVG/PNG/PDF preserva os ícones.

### Mermaid
- **Ctrl+V no canvas** detecta código Mermaid automaticamente.
- **Copiar como Mermaid**: botão direito no board ou menu **Mais** → exporta direção, formas, rótulos, subgraphs, estilos e conectores para colar no Whimsical, GitHub, Notion etc.
- Fluxogramas (`flowchart`/`graph`) viram **formas e conectores editáveis**, com layout automático via dagre, direção TD/LR/BT/RL, shapes (`[]`, `()`, `{}`, `(())`, `{{}}`, `[()]`), rótulos, arestas com/sem seta, tracejadas, grossas, labels, subgraphs como frames e `classDef`/`class`/`style` de cores.
- Tamanhos seguem o padrão do board: retângulos **192×96**, decisões **240×140**, pílulas **180×64**. O texto quebra dentro da largura padrão e o shape cresce **para baixo**; a largura não é esticada.
- `erDiagram` também é interpretado nativamente: entidades viram cards com tabela de campos, relações viram conectores com cardinalidade (`||`, `o|`, `}|`, `}o`, `o{`).
- Outros tipos Mermaid (`sequenceDiagram`, `classDiagram`, `stateDiagram`, `mindmap`, `gantt`, etc.) são renderizados e colados como imagem.
- Também há um botão **Colar Mermaid** na topbar e no menu “Mais”.
- Atalho `Ctrl+C`/`Ctrl+X` grava um marcador no clipboard; o `Ctrl+V` distingue Mermaid de objetos internos.

### Board e canvas
- Pan, zoom com Ctrl/Cmd + scroll, pinch zoom no touch e minimapa mental de atalhos.
- Grade, encaixe em grid/bordas/centros, guias de alinhamento e marquee.
- 10 formas: retângulo, pílula, elipse, decisão, triângulo, hexágono, cilindro, paralelogramo, documento e **nota adesiva**.
- **Frames com containment real**: mover/redimensionar/excluir um frame afeta os filhos; soltar uma forma dentro do frame a vincula.
- **Grupos** (`Ctrl+G` / `Ctrl+Shift+G`).
- Rotação em 90°, redimensionamento simples e múltiplo, distribuição e alinhamento.
- **Conectores** ortogonal/reto/curvo, pontas (seta, círculo, losango, garra), cardinalidade UML, rótulos, bends e pontas soltas.
- **Criar nó conectado**: botões `+` ao lado e **abaixo** da forma; o novo shape herda o estilo do nó de origem e já vem conectado.
- **Conector arrastando a bolinha azul** da forma até outra forma ou para o vazio.
- Texto com tamanho, negrito, itálico, sublinhado, alinhamento e cor.
- Imagens por upload (data URL local).
- Links externos e comentários por objeto.
- **Camadas**: árvore de frames/filhos, ocultar, bloquear e reordenar.
- Copiar/colar/duplicar com remapeamento de conectores, frames e grupos.
- Undo/redo com histórico coalescido (sem “undos fantasmas”).
- Busca no board (`Ctrl+K`), menu de contexto, ajuda (`?`) e apresentação por frames.

### Multi-board
- Dashboard com busca, thumbnails gerados em SVG, renomear, duplicar e excluir.
- Templates: fluxograma, organograma, mapa mental, kanban, retrospectiva, SWOT, wireframe e documento.
- Board de exemplo “Dayan Siebra” (funil real com 174 objetos).
- Salvamento automático em IndexedDB com migração de formatos antigos.

### Exportação
- JSON (board completo).
- **SVG do board inteiro** (não só do viewport), com fonte embutida.
- **PNG em 2×** com fundo e limites corretos.
- **PDF** via janela de impressão (Salvar como PDF).

### Tema e PWA
- Tema claro/escuro persistido.
- Manifest + service worker para uso offline depois do primeiro carregamento.

### Colaboração
- **BroadcastChannel**: sincronização automática entre abas do mesmo navegador, sem configuração.
- **Relay WebSocket opcional** para sincronizar entre dispositivos:

```bash
npm run collab
# ws://localhost:8787
```

No painel **Compartilhar**, informe o relay e entre/crie uma sala. O link compartilhado inclui o board e a sala. A sala é o único controle de acesso — **não use para dados sensíveis**. A sincronização é last-write-wins (snapshot do board), não CRDT.

## Rodando

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # produção em dist/
npm run preview      # preview da build
npm run typecheck
npm test
npm run lint
npm run collab       # relay WebSocket em :8787
```

## Estrutura

```
src/
  types.ts                 modelo de dados e guards
  store.ts                 Zustand: board, seleção, histórico, persistência, collab
  geometry.ts              roteamento, âncoras, rotação, snapping, bounds
  palette.ts               cores e estilos
  lib/
    schema.ts              normalização/migração de boards e settings
    storage.ts             IndexedDB + fallback localStorage
    templates.ts           templates e board de boas-vindas
    export.ts              SVG/PNG/PDF do board inteiro
    collab.ts              BroadcastChannel + WebSocket
    text.ts                medição e quebra de texto
  components/
    Canvas.tsx             interação do canvas, overlays e editores
    ShapeNode/FrameView/TextView/ImageNode/ConnectorView
    ContextBar.tsx         barra flutuante de estilo
    Toolbar.tsx            ferramentas, export, tema, apresentação
    LayersPanel.tsx        árvore de camadas
    Dashboard.tsx          lista de boards e thumbnails
    Modals.tsx             ajuda, busca, templates, compartilhamento
    icons.tsx              ícones SVG inline
server/relay.mjs           relay WebSocket mínimo
tests/                     Vitest (store, geometry, schema, text)
```

## Atalhos

| Ação | Atalho |
|---|---|
| Selecionar / mover tela | `V` / `H` ou `Espaço` |
| Formas | `R`, `O`, `P`, `D`, `S` |
| Texto / frame / conector / imagem | `T`, `F`, `C`, `I` |
| Desfazer / refazer | `Ctrl+Z` / `Ctrl+Y` |
| Copiar / recortar / colar / duplicar | `Ctrl+C`, `Ctrl+X`, `Ctrl+V`, `Ctrl+D` |
| Agrupar / desagrupar | `Ctrl+G` / `Ctrl+Shift+G` |
| Buscar | `Ctrl+K` |
| Centralizar / 100% | `0` / `1` |
| Bloquear | `L` |
| Ajuda | `?` |
| Apresentação | botão ▶ na toolbar; setas navegam |

## Supabase (nuvem + auth)

O app é **local-first**: IndexedDB continua funcionando sem login. Ao conectar o Supabase, boards e pastas são sincronizados entre dispositivos.

### 1. Criar as tabelas

Abra o **Supabase Studio → SQL Editor** e execute o arquivo:

```text
supabase/schema.sql
```

Ele cria `profiles`, `folders`, `boards`, `board_members`, triggers de `updated_at`, o profile automático no signup e as políticas RLS.

### 2. Configurar credenciais

Copie `.env.example` para `.env.local` e preencha:

```dotenv
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-ou-publishable-key
```

As credenciais vêm exclusivamente do ambiente (`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`). Não há formulário de credenciais no app.

> Use **somente** a anon/publishable key no cliente. Nunca coloque a `service_role` key no frontend.

### 3. Auth no self-hosted

Para links de confirmação/recuperação funcionarem, ajuste no `.env` do Supabase:

```dotenv
SITE_URL=http://localhost:5173
ADDITIONAL_REDIRECT_URLS=http://localhost:5173
```

Se quiser login imediato em desenvolvimento, habilite `ENABLE_EMAIL_AUTOCONFIRM=true`. Caso contrário, confirme o e-mail antes de entrar. Também é possível criar o usuário direto no Supabase Auth.

### 4. Como a sincronização funciona

- No login, o app compara boards locais e remotos por `updatedAt`.
- Board só local → envia para a nuvem.
- Board só remoto → baixa para o IndexedDB.
- Existe nos dois → vence o documento mais novo.
- Pastas locais e remotas são unidas; pastas são apenas upsert (sem apagar remotas por acidente).
- Edições locais são enviadas com debounce (~1,2 s).
- Excluir um board propaga a exclusão para a nuvem.
- “Enviar boards locais” força o upload de tudo.
- “Sincronizar agora” faz o merge bidirecional.

Status, erros e última sincronização aparecem no painel **Nuvem** e no botão de nuvem da sidebar.

## Autenticação e isolamento

- **Login obrigatório quando o Supabase está configurado:** o app abre numa tela de login e só libera o workspace depois de autenticar. Isso vale também em `localhost`.
- **Auth:** Supabase Auth (e-mail + senha), sessão persistida no navegador (`kdsflux.supabase.auth`).
- **Nuvem:** cada linha de `boards`/`folders` tem `owner_id`; as políticas RLS só deixam o dono ler/escrever. Dois usuários logados não veem os boards um do outro.
- **Cache local por usuário:** IndexedDB e `localStorage` são namespaced (`kds-flux:<userId>`). Ao sair, o app volta ao escopo anônimo e mostra a tela de login — nada do usuário anterior fica visível.
- **Organização por conta:** cada usuário tem `organization_name` no profile e vê esse nome no workspace/sidebar. Novos cadastros informam a organização; ela pode ser alterada depois no painel **Nuvem**.
- **Migração única:** no primeiro login, boards criados antes desse recurso (escopo anônimo) são copiados para a conta e enviados ao Supabase. A flag `kdsflux.storage.scoped` impede que uma segunda conta herde esses boards.
- **Sem credenciais:** se `VITE_SUPABASE_*` não estiver definido, o app continua funcionando localmente (sem login) e mostra “Supabase não configurado” no painel Nuvem.
- **Painel de admin:** criar/gerenciar usuários em Supabase Studio → Authentication → Users.

## Deploy no Easypanel

O repositório traz `Dockerfile` (app estático em nginx) e `Dockerfile.relay` (relay WebSocket opcional).

### App web

1. Easypanel → **Create App** → Source: seu repositório Git.
2. Build: **Dockerfile**, caminho `Dockerfile`, porta **80**, healthcheck `/healthz`.
3. Em **Ambiente** (Environment), informe:
   - `VITE_SUPABASE_URL=https://seu-projeto.supabase.co`
   - `VITE_SUPABASE_ANON_KEY=sua-anon-key`
4. Aponte o domínio e faça o deploy.

Não existe mais formulário de credenciais no app: a configuração vem só do ambiente. O container gera `/env.js` no start a partir dessas variáveis, então **mudar credenciais exige apenas reiniciar/reimplantar o serviço**, sem rebuild. Também é possível passá-las como Build Args (ficam embutidas no bundle). Nunca use a `service_role` key aqui.

### Relay de colaboração (opcional)

1. Crie outro App, mesmo repositório, Dockerfile `Dockerfile.relay`, porta **8787**, healthcheck `/health`.
2. No board, abra **Compartilhar** e use `wss://relay.seudominio.com` como Relay WebSocket.

### Variáveis de ambiente

- **Runtime (recomendado):** variáveis em **Ambiente/Environment** do Easypanel. O entrypoint do container escreve `env.js` com URL e anon key; o app lê isso antes de iniciar. Trocar valores = reiniciar o serviço.
- **Build Args:** `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` embutidas no bundle pelo Vite. Exigem rebuild para mudar.
- A credencial de runtime tem prioridade sobre a de build.

### Troubleshooting

- **Bolinha amarela / sem logs:** confira em **Fonte** se o build está em **Dockerfile** (não Nixpacks/Heroku) e em **Implantação** os logs de build. O container precisa subir o nginx na porta **80**.
- **Healthcheck:** use `/healthz` (responde `ok`). O `Dockerfile` já declara esse healthcheck.
- **“Supabase não configurado” no app:** as variáveis não chegaram ao container. Confira em **Ambiente**, salve e reinicie; o log deve mostrar `runtime-env: Supabase credentials injected from environment.`
- **“Error sending confirmation email” ao criar conta:** o SMTP do Supabase é falso (`supabase-mail`). Habilite `ENABLE_EMAIL_AUTOCONFIRM=true` no `.env` do stack Supabase e reinicie o serviço `auth`, ou crie o usuário em **Authentication → Users** com “Auto Confirm User”. Para links reais, configure um SMTP de verdade.
- **Domínio:** aponte o domínio para a porta 80 do serviço.

### Docker Compose (alternativa)

```bash
VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... docker compose up -d --build
```

Sobe o app em `:8080` e o relay em `:8787`.

## Modelo de dados

Cada objeto tem `id`, `objectType`, `parentId` (frame), `groupId`, `order`, `rotation`, `hidden`, `locked`, `link` e `comments`. Shapes/frames/texts carregam `style` e `textStyle`; conectores carregam âncoras relativas, pontas, cardinalidade, bends e pontos soltos. O board tem `version: 2` e timestamps.

`normalizeBoard()` valida e migra qualquer JSON antigo antes de renderizar; importações inválidas são rejeitadas ou saneadas.

## Limitações conhecidas

- Colaboração é **snapshot last-write-wins**, não CRDT; edições simultâneas no mesmo objeto podem se sobrescrever.
- O relay não tem autenticação, persistência nem TLS embutido.
- Fluxogramas e ER Mermaid viram objetos editáveis; outros tipos Mermaid entram como imagem (não editáveis).
- Rich text é por objeto (negrito/itálico/sublinhado globais), não por trecho.
- Itens fora do escopo: wireframes/docs/kanban interativo, comentários em thread com menções, permissões, versão histórica e apps móveis nativos.

## Licença

Uso livre para estudo e experimentação.

- **Colar outline como mapa mental:** listas com indentação (ex.: copiadas de um mapa mental) viram nós conectados automaticamente, com cores por ramo.
