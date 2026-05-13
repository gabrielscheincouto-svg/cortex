# Cortex — guia de marca

> O cérebro do escritório contábil.

Este documento define como o produto se comunica visualmente, verbalmente e conceitualmente. Toda nova tela, microcopy ou elemento gráfico deve passar por aqui antes de ir pro código.

## Posicionamento

**Cortex é o cérebro do escritório contábil:**
- **Pensa** — entende dados e legislação, sugere ações inteligentes
- **Lembra** — memória institucional que nada esquece (audit log, conquistas, histórico)
- **Conecta** — sinapses entre dados, equipe, clientes e legislação em tempo real
- **Decide** — capacita o time a tomar melhores decisões, mais rápido

Não é "mais um software de gestão". É a inteligência operacional que organiza, automatiza e amplifica o escritório contábil moderno.

## Nome, domínio, propriedade

| Item | Valor |
|---|---|
| Nome comercial | **Cortex** |
| Logotipo escrito | `cortex` (minúsculo) ou `CORTEX` em uppercase para selos |
| Domínio primário | **usecortex.com.br** |
| Domínio defensivo | usecortex.com (a registrar) |
| Email institucional | contato@usecortex.com.br |
| Suporte | suporte@usecortex.com.br |
| Razão social proprietária | (a definir — provavelmente a própria CECOPEL ou nova entidade) |
| Trademark | INPI classes 9 (software) e 42 (serviços de TI) — verificar e registrar |

## Tagline

**Principal:** "O cérebro do escritório contábil"

**Variações por contexto:**
- Vendas: "Pense menos. Entregue mais."
- Onboarding: "Bem-vindo ao Cortex — sua nova memória de escritório."
- Erro/empty state: "Cortex ainda está aprendendo sobre seu escritório."
- IA agindo: "Cortex sugere..." / "Cortex pensou em..."

## Paleta de cores

Alinhada 1:1 com o **brandbook oficial Usecortex** (maio/2026).

| Token | Cor | Hex | Uso |
|---|---|---|---|
| `ink-900` | azul marinho | `#0B1324` | "massa cinzenta" — header, sidebar, fundos densos, texto principal |
| `ink-500` | cinza frio | `#6B7280` | texto secundário, ícones inativos |
| `ink-100` | cinza claro | `#F1F5F9` | superfícies frias, divisores |
| `brand-500` ⭐ | verde brilhante | `#22C55E` | atividade saudável, status positivo, ações primárias, brand |
| `brand-900` | verde escuro | `#0F5132` | profundidade, hover, raízes do "C" no símbolo |
| **`mind-500`** | violeta inteligência | `#7C3AED` | Cortex IA / cognição / sugestões automáticas |
| `mind-100` | lilás claro | `#EDE9FE` | fundos sutis de seções com IA |
| `gold-500` | dourado | `#D4AF37` | gamificação (conquistas, ranking, pontos) |
| `rose-500` | rosé | `#E7A1AC` | alertas suaves, humanização, NPS, super-admin |

**Regra dos hemisférios** (lendo o símbolo do brandbook):
- **Topo do C = verde** → o que o sistema faz/registra/calcula (sistema saudável, dados confiáveis, status positivo)
- **Base do C = violeta** → o que a IA *interpreta* daqueles dados (Cortex, sugestões, memória, ações propostas)
- **Nó dourado de transição** → momentos em que esses dois mundos se encontram → gamificação, premiações, conquistas

Não pulverizar violeta — ele só aparece onde há inteligência atuando.

**Tokens já aplicados em `web/tailwind.config.ts` e `admin/tailwind.config.ts`.**

## Tipografia

| Fonte | Uso | Peso |
|---|---|---|
| **Inter** | Toda a UI — corpo, headers, labels | 400, 500, 600, 700 |
| **DM Mono** | Códigos, CNPJ, IDs, valores monetários alinhados | 400, 500 |

Sem fonte serif. Sem fonte decorativa.

## Identidade visual — elementos "cérebro"

O conceito de cérebro precisa aparecer sutilmente, nunca literal/infantil. Sem ícone de cérebro desenhado em todo lugar.

**1. Logotipo (a desenhar)**

Conceito sugerido para o designer:
- Símbolo: um **C estilizado formado por linhas/nodes conectados** (sinapses)
- Ou: 3-4 pontos conectados formando uma rede, que sugere "C" ao olhar de longe
- Variação monocromática (preto ou branco) + variação color (ink-900 + brand-500)
- Tipografia: "cortex" em Inter Bold, kerning -1%

**2. Pulsação neural**

Pequeno indicador no header (canto superior esquerdo, ao lado do logo) que **pulsa lentamente** quando o sistema está processando algo: arquivo sendo identificado pelo robô, IA pensando, worker rodando.

CSS sugerido:
```css
.cortex-pulse {
  width: 8px; height: 8px;
  background: var(--brand-500);
  border-radius: 50%;
  animation: cortex-pulse 2s ease-in-out infinite;
}
@keyframes cortex-pulse {
  0%, 100% { opacity: 0.4; transform: scale(1); }
  50%      { opacity: 1.0; transform: scale(1.15); }
}
```

**3. Background neural sutil em telas chave**

Home, Dashboards e tela do Cortex (drawer da IA) podem ter um SVG de fundo extremamente sutil (opacity 3-5%) com pequenos nodes conectados por linhas finas. Não vira poluição visual — só sente.

**4. Avatar da IA — o "C" de nós conectados**

Quando o Cortex "fala" no chat ou drawer:
- Não usar avatar humano fake.
- Usar o **símbolo oficial do brandbook**: um "C" formado por nós conectados, hemisfério verde no topo e violeta na base, com um nó dourado de transição.
- Implementado em `web/components/cortex/message-bubble.tsx` → `<CortexAvatar size={32} pulsando={streaming} />`.
- Quando `pulsando=true`, os nós do hemisfério violeta animam (efeito de "sinapse ativa") — só quando o assistente está respondendo.
- O mesmo SVG é reusado no launcher (bottom-right, 14×14) e na tela de memórias.

**5. Empty states**

Em vez de "Sem dados" frio, usar narrativa do Cortex aprendendo:
- "Cortex ainda não tem dados suficientes aqui"
- "Adicione sua primeira empresa para o Cortex começar a aprender"
- "Cortex registrou 0 atrasos esta semana — escritório no ritmo"

## Tom de voz

Cortex é **inteligente, conciso, profissional, sem ser frio**. Fala como um analista sênior do escritório que respeita seu tempo.

**Faz:**
- Frases curtas, sem floreio
- Cita fonte quando faz afirmação (especialmente legislação)
- Reconhece limites — "ainda estou aprendendo isso", "preciso confirmar com você"
- Trata o user pelo primeiro nome quando relevante

**Não faz:**
- Não usa "vamos lá!", "oba!", emojis excessivos
- Não inventa quando não sabe — admite e sugere onde verificar
- Não fala como bot ("Como posso ajudá-lo hoje?") — fala direto

**Antes / depois:**

| ❌ Genérico | ✅ Cortex |
|---|---|
| "Olá! Como posso te ajudar?" | "Caroline, 3 obrigações da Aquarela vencem hoje. Quer ver?" |
| "Erro ao carregar dados" | "Não consegui ler os balancetes da Comaq. Veja o detalhe →" |
| "Dashboard" | "Visão do escritório" |
| "Salvar com sucesso" | "Registrado. Cortex atualizou sua memória." |
| "Sem resultados" | "Cortex não encontrou nada com esses filtros." |

## Microcopy — substituições recorrentes

Aplicar progressivamente em todo o sistema:

| Onde dizia | Passa a dizer |
|---|---|
| "Histórico" | "Memória" |
| "Integrações" | "Sinapses" |
| "Atividade recente" | "Pulsação recente" |
| "Vinculado a" | "Conectado a" |
| "Atualizar dados" | "Atualizar memória" |
| "Notificações" | "Sinais" |
| "Configurações da IA" | "Como o Cortex pensa" |
| "Limpar histórico de conversa" | "Esquecer esta conversa" |
| "Aprender com..." | "Cortex aprendeu com..." |

Não traduzir tudo de uma vez — fazer migração orgânica nos novos textos. Termos consolidados ("Entregas", "Empresas", "Solicitações") continuam — são contábeis, não dá pra brincar.

## Hierarquia de elementos visuais

Ordem de destaque numa página típica:

1. **Header / barra superior** — identidade do escritório + cortex-pulse + perfil
2. **Conteúdo principal** — dados, tabelas, formulários (branco, alta legibilidade)
3. **Sidebar de navegação** — secundária, branca, módulos do plano
4. **Drawer do Cortex** — overlay direito (collapsável), `mind-*` discreto no fundo
5. **Tray/footer** — minimalista, apenas status

## Aplicação imediata (próximas iterações do Codex)

Quando o Codex pegar TASK-060 (drawer da IA Cortex), seguir:

- Avatar do Cortex: "C" de nós conectados (símbolo oficial do brandbook) — verde no topo, violeta na base, nó dourado de transição
- Cor de destaque do drawer: `mind-*` ramps
- Microcopy: "Cortex está pensando..." / "Cortex sugere..." / "Cortex consultou X documentos da legislação"
- Pulsação neural enquanto streaming roda

Em TASK-064 (Cmd+K), o palette se chama **Cortex Quick** ou simplesmente **Cortex** com placeholder "Pergunte ou peça algo ao Cortex...".

## Brand assets a produzir (próximas semanas)

1. **Logo definitivo** — contratar designer (custo ~R$ 1.000-3.000 freelance). Brief: símbolo neural abstrato + wordmark
2. **Favicon** — versão do símbolo em 32x32, 64x64, 128x128
3. **OG image** — 1200x630 para preview no LinkedIn/WhatsApp (homepage + landing)
4. **Apresentação institucional** — 8-10 slides para vendas
5. **Landing page** — usecortex.com.br com proposta + casos de uso + pricing
6. **Avatar do Cortex (IA)** — versão animada (Lottie) e estática

## Checklist de registro

Imediato (hoje/amanhã):
- [ ] Registrar `usecortex.com.br` no registro.br
- [ ] Registrar `usecortex.com` na Cloudflare/Namecheap (defensivo)
- [ ] Verificar trademark INPI `Cortex` classes 9 e 42
- [ ] Reservar handles sociais: @usecortex (X/Twitter, Instagram, LinkedIn)
- [ ] Criar Google Workspace ou Zoho Mail com domínio próprio

Curto prazo (próximas 2 semanas):
- [ ] Contratar logo
- [ ] Atualizar `web/tailwind.config.ts` com `mind` ramp
- [ ] Atualizar `web/app/globals.css` com classe `.cortex-pulse`
- [ ] Atualizar título do navegador e meta tags para Cortex
- [ ] Adicionar campo `nome_plataforma` em `orgs` (default: "Cortex") para white-label
