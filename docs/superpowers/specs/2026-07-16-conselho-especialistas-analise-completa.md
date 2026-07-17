# Análise do Conselho de Especialistas — MMA Manager v2.0

> **Data:** 2026-07-16
> **Escopo:** Análise completa de todos os sistemas do jogo, identificação de problemas estruturais e propostas de melhoria rumo à qualidade AAA independente.
> **Metodologia:** Conselho composto por 14 especialistas — Game Design, Game Direction, Systems Design, Narrative Design, UX/UI, Arquitetura de Software, Economia/Balanceamento, IA de NPCs, Jogos de Gerenciamento Esportivo, Treinador de MMA, Ex-lutador Profissional, Matchmaker, Analista de Performance e Psicologia Esportiva.

---

## Estado Geral do Projeto

**Diagnóstico preliminar:** O projeto está NUM estado excepcionalmente maduro para um jogo独立 (indie) em desenvolvimento. A arquitetura MVC com vanilla JS + IndexedDB é limpa, a separação de responsabilidades entre models/services/controllers/views é consistente, e o design spec (`2026-07-13-carreira-sistemica-1-lutador-design.md`) é um dos mais completos já vistos em projetos deste porte.

**Nota geral:** Este projeto NÃO precisa de uma reescrita. Precisa de cirurgias precisas em pontos específicos para atingir o nível AAA. A fundação é sólida — os problemas estão nos detalhes.

---

## 1. MOTOR DE SIMULAÇÃO (SimulationEngine)
**Responsável:** Systems Designer + Programador + Treinador de MMA

### O que já está excelente
- Sistema de rounds com 10-point must scoring é autêntico ao esporte
- Plano de jogo com counter-picking (strongVs/weakVs) é elegantemente simples
- Sistema de "arma nova" (TapeService/weapon) é um dos melhores mechanics de longo prazo
- Prontidão (ReadinessService) como agregador de decisões pré-luta é brilhante

### Problemas identificados

#### P1.1 — Ações por round são abstratas demais
**O problema:** O motor calcula performance por round como um número contínuo, mas o jogador nunca vê golpes individuais, quedas, ou submissões tentadas. A abstração é elegante para simulação em massa (lutas IA x IA), mas rouba a emoção das lutas do jogador.

**Solução proposta:** Introduzir um sistema de "momentos críticos" (Critical Moments) — 2-4 eventos discretos por round que são resolvidos individualmente e exibidos ao jogador. Cada momento testa um atributo específico (ex: poder vs chin, wrestling vs defesa de queda, BJJ vs defesa de submissão) e o resultado acumula no score do round.

**Impacto:** A experiência de luta passa de "ver um número flutuando" para "ver momentos reais de MMA". A IA pode ser simulada no modo abstrato atual; só a luta do jogador precisa dos momentos críticos.

#### P1.2 — Plano de jogo é binário demais
**O problema:** Acertar o plano = +10%, errar = -8%. Não há gradação por quão bem você leu o adversário. No MMA real, um plano de jogo bem executado com base em scouting profundo é muito mais eficaz que um palpite.

**Solução proposta:** Graduar o bônus do plano de jogo pelo nível de scouting:
- Nível 1 (rosto): bônus/penalidade cheio (vc está no escuro completo)
- Nível 2 (faixas): 70% do bônus
- Nível 3 (números): 50% do bônus (vc já sabe tudo, a execução depende de vc)
- Nível 4 (completo): 30% do bônus (vc conhece cada detalhe)

Isso faz com que estudar o adversário seja uma decisão estratégica contínua, não um "compre o relatório mais caro sempre".

#### P1.3 — Atributos expandidos (power, speed) têm peso pequeno demais
**O problema:** A Fase 3 adicionou `power`, `speed`, `composure`, `takedowns`, `submissionOffense`, `submissionDefense`, mas estes atributos têm impacto marginal comparado aos 14 originais.

**Solução proposta:** Rebalancear os pesos na fórmula de `strikingScore`, `grapplingScore` e `overallRating` para que os 6 novos atributos correspondam a ~30% do score total. Em particular:
- `power` deve pesar 3x mais em strikingScore
- `speed` deve afetar tanto striking quanto defesa
- `takedowns` e `groundControl` devem dividir o peso de grappling com wrestling/bjj

---

## 2. PROGRESSÃO E TREINAMENTO
**Responsável:** Especialista em Economia/Progressão + Preparação Física + Analista de Performance

### O que já está excelente
- Sistema de camp (TrainingCamp) com intensidade/foco/recuperação é muito bom
- Osmose entre parceiros de treino (TrainingPartnersService) é inovador
- Sinergia técnico-atleta (coachSynergy) como mecânica de longo prazo é ótima
- DNA oculto e auto-descoberta são o coração da rejogabilidade

### Problemas identificados

#### P2.1 — Treino semanal (non-camp) é automático demais
**O problema:** `_applyWeeklyTraining` no GameController roda automaticamente, atribuindo ganhos ao foco escolhido. O jogador só interage com treino DURANTE o camp — nas semanas livres, ele só muda o foco e avança. É passivo demais.

**Solução proposta:** Introduzir "microdecisões de treino" semanais:
- A cada 3-4 semanas sem luta, o jogador escolhe entre: treino intenso (ganho maior, risco de lesão), treino técnico (progressão de golpes), recuperação ativa (menos fadiga, ganho pequeno), ou trabalho com parceiro específico
- Isso transforma semanas "mortas" (sem ofertas, sem luta) em semanas de progressão ativa

#### P2.2 — Recuperação de lesão é genérica
**O problema:** Lesão é apenas `{ untilAbsWeek, description }`. Não há reabilitação, fisioterapia, ou escolhas durante a recuperação. O jogador só espera.

**Solução proposta:** Sistema de reabilitação em 3 estágios:
1. **Repouso obrigatório** (primeiras X semanas) — não pode treinar nada
2. **Fisioterapia** (semanas seguintes) — escolha entre recuperação mais rápida (custa dinheiro) ou mais lenta (grátis)
3. **Retorno gradual** — treino com intensidade reduzida até recuperar 100%

O custo da fisioterapia cria um dilema financeiro real: gastar dinheiro para voltar mais rápido ou aceitar a pausa e preservar o caixa.

#### P2.3 — Declínio por idade é suave demais
**O problema:** `_applyAgeDecline` reduz atributos gradualmente, mas não há "paredes" ou eventos de declínio abrupto. No MMA real, lutadores frequentemente têm uma queda súbita de performance.

**Solução proposta:** Adicionar "CHECKPOINTS DE IDADE" — idades específicas (33, 35, 38, 40) onde há uma chance de declínio acelerado em atributos físicos (speed, power, cardio, recovery). Um lutador pode ser exceção (sortudo no DNA), mas a regra geral é que o declínio acelera com a idade.

---

## 3. ECONOMIA E FINANÇAS
**Responsável:** Especialista em Economia + Ex-lutador + Analista de Performance

### O que já está excelente
- Custo de vida quebrado em categorias (aluguel, comida, transporte, lazer)
- Serviços opcionais (nutricionista, psicólogo, etc.)
- Patrocínios com metas e cláusulas de imagem
- Empresário com corte na bolsa

### Problemas identificados

#### P3.1 — Apenas UMA fonte de receita além de lutas
**O problema:** As únicas fontes de receita são bolsa de luta e patrocínio. Não há:

- Bônus de performance (Fight of the Night, Performance of the Night)
- Participação em eventos promocionais (entrevistas pagas, aparições)
- Revenue share em PPV (para lutadores populares)
- Aulas particulares ou workshops (para veterano)

**Solução proposta:** Adicionar:
1. **Bônus pós-luta** automáticos: FOTN ($X), POTN ($Y) — calculados pela qualidade da luta no WorldService
2. **Eventos promocionais** ocasionais: a promoção paga para você aparecer no media day, custa 1 semana de descanso mas rende $$$
3. **PPV share**: quando o lutador atinge popularidade 70+, uma pequena porcentagem da receita estimada do evento vai pra ele

#### P3.2 — Corte do empresário não gera tensão
**O problema:** Empresário tira 5-15% e dá bônus de negociação. É uma troca puramente matemática. Não há conflito de interesses, negociação de contrato com o empresário, ou risco de empresário ruim.

**Solução proposta:** Adicionar:
- Empresários com **agendas ocultas** — alguns priorizam o dinheiro (vão te pressionar a aceitar lutas arriscadas), outros priorizam a carreira
- Eventos de **conflito** — empresário aceita uma luta sem consultar, ou recusa uma oferta que você queria
- Sistema de **confiança** (já existe parcialmente) com consequências reais — confiança baixa = empresário age contra seus interesses

#### P3.3 — Custo de academia não escala
**O problema:** Academia custa `weeklyFee` fixo. Para um lutador ganhando $10k/luta, $150/semana é nada. Não há incentivo para trocar de academia por questões financeiras.

**Solução proposta:** Academias de elite (facilityLevel 4) devem custar significativamente mais (ex: $1.000-2.500/semana), criando um dilema real: "eu consigo bancar esta academia de elite entre as lutas?".

---

## 4. SISTEMA DE LUTAS E MATCHMAKING
**Responsável:** Matchmaker do UFC + Ex-lutador + Game Designer

### O que já está excelente
- Geração de ofertas baseada em tier/popularidade/OVR window
- Priorização de rivalidades na seleção de oponentes
- Reencontros com ex-colegas de academia
- Sistema de cinturão com defensas e desafiante mandatório
- Cinturão interino para campeão lesionado

### Problemas identificados

#### P4.1 — Ausência de "main event" vs "co-main" vs "prelim"
**O problema:** Todas as ofertas são tratadas igualmente. No MMA real, a posição no card muda completamente a relevância da luta — lutas de título são sempre main event, e o jogador deveria poder recusar ser rebaixado para prelim.

**Solução proposta:** Toda oferta deve incluir `cardPosition` ('main_event', 'co_main', 'featured_prelim', 'preliminary'). A posição é determinada por:
- Lutas de título → main event
- Popularidade alta + rivalidade → co-main ou main event
- Popularidade média → featured prelim
- Popularidade baixa → preliminary

Isso adiciona status social como recompensa: subir no card é uma conquista visível.

#### P4.2 — Ausência de "short notice" fights
**O problema:** Toda oferta respeita `OFFER_CONFIG.MIN_WEEKS_NOTICE`. No MMA real, substituições de última hora são comuns e criam histórias incríveis.

**Solução proposta:** ~10% das ofertas devem ser "short notice" (2-3 semanas de aviso). Essas lutas pagam BÔNUS (1.5x-2x a bolsa normal) mas exigem camp acelerado com risco maior de lesão e prontidão mais baixa.

#### P4.3 — Trilha de carreira pós-título é genérica
**O problema:** Depois que o jogador vence o cinturão, o loop é o mesmo: defender, defender, defender. Não há:
- "Super fights" contra campeões de outras divisões ou promoções
- Mudança de divisão com chance de "double champion" status
- Legado construído por número de defesas vs qualidade dos oponentes

**Solução proposta:**
1. **Super fights**: quando popularidade 85+, ofertas de cross-promotion aparecem (luta de campeões)
2. **Double champion**: sistema de mudança de peso com risco — subir de peso testa seu poder, descer testa seu corte. Ser campeão em duas divisões gera entrada especial no Hall da Fama
3. **Qualidade de defesas**: o legado do cinturão não conta só número de defesas, mas o OVR médio dos oponentes defendidos — defender contra #15 não vale o mesmo que contra #1

---

## 5. NARRATIVA E HISTÓRIAS EMERGENTES
**Responsável:** Narrative Designer + Game Director

### O que já está excelente
- CareerLogService como fonte única de histórias
- Cerimônia de aposentadoria como documentário de carreira
- Descoberta de DNA como revelação narrativa
- Rivalidades com tipos (grudge, robbery, competitive, personal)
- Sistema de provocações em coletiva de imprensa

### Problemas identificados

#### P5.1 — CareerLog não gera eventos jogáveis
**O problema:** CareerLog é só um registro passivo. Os eventos que poderiam gerar escolhas narrativas (ex: rival te provocou → como você responde?) são raros e limitados a redes sociais.

**Solução proposta:** Transformar CareerLog em motor de eventos narrativos:
- A cada ~5 semanas, um evento do CareerLog vira um **momento de escolha**
- Escolhas têm consequências de curto (moral, popularidade) e longo prazo (rivalidade, oportunidades de luta)
- Exemplos: "Seu ex-parceiro de treino venceu uma luta importante e te chamou no Twitter — como responde?", "A imprensa está especulando que você está em decline — como reage?"

#### P5.2 — Ausência de "histórias de bastidores"
**O problema:** O jogo foca exclusivamente no atleta. Não há:
- Problemas pessoais (família, financeiros fora do MMA, questões legais)
- Dilemas morais (lutar contra amigo que precisa da bolsa mais que você)
- Pressão da mídia em momentos ruins

**Solução proposta:** Adicionar eventos narrativos contextuais:
- Derrrota → notícias negativas, fãs questionando, dúvida pessoal
- Vitória importante → assédio da mídia, propostas, tentação de excessos
- Lesão grave → questionamento existencial ("será que volto?")
- Sequência de vitórias → hype excessivo, pressão de performance

#### P5.3 — Fim de carreira não tem escolhas significativas
**O problema:** A aposentadoria é um evento. O jogador treina, começa a declinar, eventualmente se aposenta. Não há:
- "Fight pass" (luta a mais por dinheiro, arriscando o legado)
- Retorno (como JJ, GSP, Ngannou)
- Transição para carreira pós-luta (técnico, comentarista, dono de academia)

**Solução proposta:** Adicionar o "Último Capítulo" — um conjunto de decisões quando o lutador está em decline avançado (35+ anos):
1. Aposentadoria digna → Hall da Fama garantido
2. "Uma última luta" → bônus financeiro grande, risco de perder o legado
3. Pedir demissão → lutar até não poder mais (declínio acelera, risco de lesão permanente)
4. Pós-carreira → virar técnico (novo jogo+?), comentarista (renda passiva), ou sumir

---

## 6. SISTEMA DE REDES SOCIAIS E IMPRENSA
**Responsável:** Narrative Designer + Game Designer + Especialista em Marketing Esportivo

### O que já está excelente
- Escolhas de postagem com riscos/recompensas
- Provocação só disponível com rival ativo
- Cláusula de imagem conectada com patrocínios
- Pedido público de chance de título

### Problemas identificados

#### P6.1 — Redes sociais são muito previsíveis
**O problema:** Sempre as mesmas 4 opções (provocar, pedir título, responder críticas, ficar quieto). Depois de 3-4 interações, o jogador já sabe exatamente o que cada escolha faz.

**Solução proposta:** Expandir o sistema com:
- **Contexto variável**: as opções mudam baseado no momento da carreira (ex: após derrota → opção de "pedir desculpas aos fãs" ou "culpar a preparação"; após vitória → "comemorar exageradamente" ou "manter humildade")
- **Reações imprevisíveis**: o público reage de forma semi-aleatória — um post seguro pode viralizar negativamente por acaso
- **Influência do rival**: se o rival tem redes sociais ativas, ele responde — criando um diálogo público

#### P6.2 — Conferência de imprensa é repetitiva
**O problema:** São sempre as mesmas 4 perguntas com as mesmas 3 opções de resposta. O jogador decora a melhor resposta rapidamente.

**Solução proposta:**
- **Perguntas contextuais**: baseadas no oponente (ex: se ele é grappler → "como você lida com o wrestling dele?"; se ele vem de KO → "você está preocupado com o poder dele?")
- **Respostas com histórico**: respostas muito agressivas em várias coletivas criam reputação de "vilão"
- **Consequências a longo prazo**: respostas podem afetar a disposição do oponente em revanche, a opinião dos fãs, e até ofertas de patrocínio

---

## 7. INTERFACE E USER EXPERIENCE
**Responsável:** UX/UI Designer + Game Director

### O que já está excelente
- Sistema de design tokens com identidade visual forte (red corner/blue corner)
- Tipografia com IBM Plex + Archivo é excelente
- Animações GSAP para transições
- Rive icons com motion design
- Dashboard com pôster de luta (fight poster) é uma ideia fantástica

### Problemas identificados

#### P7.1 — Sobrecarga de informação no Dashboard
**O problema:** O dashboard tenta mostrar tudo de uma vez: pôster da luta, atributos do lutador, últimas notícias, calendário, ofertas pendentes. Para um jogador novo, é avassalador.

**Solução proposta:** Implementar um design de "progressão de informações":
1. **O que importa AGORA** no topo (luta marcada ou "sem luta — veja ofertas")
2. **O que importa em breve** no meio (próximos eventos, ofertas prestes a expirar)
3. **O que é contextual** embaixo (notícias, notificações, grind)

O Fighter Profile (tela separada) mostra os atributos em detalhe — não precisa poluir o dashboard com eles.

#### P7.2 — Feed de notícias é genérico
**O problema:** As notificações são um feed linear sem hierarquia visual. Uma manchete (título mundial) tem o mesmo tratamento visual que "oferta expirou".

**Solução proposta:**
- Manchetes com destaque visual (card maior, cor de cinturão, animação de entrada)
- Notícias de rivalidade com foto de ambos os lutadores lado a lado
- Resultados de eventos com layout de card de luta (vs)
- Hierarquia: headline > achievement > warning > info, cada um com tratamento visual diferente

#### P7.3 — Tela de ofertas precisa de comparação visual
**O problema:** O jogador vê uma oferta por vez. Decidir entre ofertas concorrentes exige voltar, comparar mentalmente, avançar de novo.

**Solução proposta:** Quando há múltiplas ofertas, mostrar todas em um layout de grid comparativo: bolsa, oponente (OVR, estilo, recorde), semanas até o evento, posição no card, lado a lado. Como comparar voos num booking site.

#### P7.4 — Onboarding é inexistente
**O problema:** Após criar o personagem, o jogador é jogado no dashboard. Não há tutorial, dica contextual, ou orientação sobre o que fazer.

**Solução proposta:** Introduzir um sistema de "primeiro contrato" guiado:
- Primeira semana tem notificações explicativas
- Botões com tooltips contextuais na primeira vez que cada tela é acessada
- Sistema de "missões de tutorial" leves: "Aceite sua primeira oferta → Configure seu camp → Pese → Lute"
- Progressivamente, as dicas desaparecem (nunca mais atrapalham)

---

## 8. ARQUITETURA E CÓDIGO
**Responsável:** Arquiteto de Software + Programador

### O que já está excelente
- Arquitetura MVC limpa e consistente
- Separação entre controllers (orquestração), services (regras), views (renderização)
- Código bem comentado com referências ao design spec
- IndexedDB como storage com store names tipados
- Sistema de migração de DB versionado

### Problemas identificados

#### P8.1 — View classes são estáticas com strings de HTML
**O problema:** Todas as views usam métodos estáticos que montam HTML como template strings. Isso torna impossível testar componentes isoladamente, e mistura lógica de apresentação com marcação.

**Solução proposta:** Extrair templates para funções puras (já é parcialmente o caso), e separar a lógica de estado da view da lógica de renderização. Não precisa de framework — mas criar um padrão de ViewState (objeto de estado puro) que a view consome tornaria o código mais testável.

#### P8.2 — GameController tem responsabilidade demais
**O problema:** GameController faz TUDO: gerencia economia, treino, ofertas, contrato, empresário, lesões, evolução, milestones, social media, carreira, hall da fama... São ~1800 linhas.

**Solução proposta:** Quebrar em controllers especializados:
- `TrainingController`: treino, camp, parceiros, lesão
- `FinanceController`: economia semanal, patrocínios, custo de vida
- `CareerController`: evolução, milestones, hall da fama, aposentadoria
- `NarrativeController`: redes sociais, coletiva, eventos narrativos
- `ContractController`: contratos de promoção, negociação, rescisão (já existe ContractService mas a orquestração está no GameController)

GameController vira um orchestrator que delega para os controllers especializados.

#### P8.3 — Falta de testes de integração
**O problema:** Não há testes que validem o fluxo completo de uma semana: treino → oferta → aceitar → camp → evento → resultado. Os testes unitários existentes cobrem funções isoladas, mas bugs de integração (ex: prontidão não atualizando, contrato não consumindo luta) são comuns.

**Solução proposta:** Criar um test helper `SimulateWeek(playerFighterId)` que executa uma semana completa e verifica invariantes:
- Caixa do lutador mudou corretamente
- Luta foi registrada no histórico
- Contrato consumiu uma luta (se aplicável)
- Rankings foram atualizados
- Lesões foram aplicadas/recuperadas

#### P8.4 — DB._tx/_txw criam memory leak potencial
**O problema:** Cada operação de DB cria uma nova transaction. Em operações em lote (batchPut, getAll com muitos registros), múltiplas transações simultâneas podem causar `TransactionInactiveError` no IndexedDB.

**Solução proposta:** Implementar um transaction pool ou fila de transações que serialize writes. Para reads, transações readonly podem ser paralelas sem problema.

---

## 9. REJOGABILIDADE E VARIEDADE
**Responsável:** Game Director + Systems Designer

### O que já está excelente
- DNA oculto garante que cada carreira é diferente
- Arquétipos e origens variam a experiência inicial
- Mundo simulado significa que a IA cria histórias diferentes a cada save

### Problemas identificados

#### P9.1 — Progressão é linear demais
**O problema:** A jornada é sempre a mesma: tier 3 → tier 2 → tier 1 → cinturão → defesas. O caminho pode ter mais ou menos lutas, mas a direção é previsível.

**Solução proposta:** Adicionar "eventos de carreira" que forçam desvios:
- **Convite para reality show** (The Ultimate Fighter-style) — 3 lutas em 6 semanas, eliminação, bônus grande
- **Lesão grave do rival** — a rivalidade morre sem conclusão, ou vira "o que poderia ter sido"
- **Crise na promoção** — a promoção onde você luta pode falir/ser comprada, forçando migração
- **Weight bullies** — oponentes que cortam peso agressivamente e voltam enormes, decisão de enfrentar ou não

#### P9.2 — Ausência de modos alternativos
**O problema:** É só carreira. Não há desafios, cenários, ou "o que aconteceria se".

**Solução proposta:** Adicionar "Desafios" (desbloqueáveis após completar uma carreira):
- **"Do Zero"**: comece com OVR 50, sem equipamento, sem empresário
- **"Veterano"**: comece com 35+ anos, 3 anos até a aposentadoria
- **"Peso Pesado":** desbloqueie a divisão Heavyweight (bloqueada inicialmente por complexidade)
- **"Revanche":** comece com uma rivalidade já no nível 5 contra um oponente específico

---

## 10. SISTEMA DE DANO E LESÕES
**Responsável:** Preparação Física + Ex-lutador + Analista de Performance

### O que já está excelente
- Lesões por treino com chance baseada em intensidade
- Cicatrizes permanentes como marcador de carreira
- Sistema de suspensão médica pós-luta

### Problemas identificados

#### P10.1 — Lesões acumuladas não afetam longevidade
**O problema:** Cicatrizes permanentes são cosméticas no código. Lesões não deixam sequelas mecânicas — um lutador com 10 lesões no currículo treina igual a um que nunca se machucou.

**Solução proposta:** Cada lesão séria deixa uma "sequela mecânica" pequena mas cumulativa:
- Lesão no joelho → -2 speed permanente
- Lesão no ombro → -2 power
- Lesão no pescoço → -2 chin
- Concussão → -2 composure

Isso faz com que gerenciar risco de lesão seja uma decisão estratégica de CARREIRA, não só de curto prazo.

#### P10.2 — Ausência de lesões durante a luta
**O problema:** Lesões só acontecem no treino. Durante a luta, atributos não mudam — um lutador com o joelho estourado continua lutando normalmente.

**Solução proposta:** Durante a simulação, pequena chance de lesão por round que reduz atributos específicos para os rounds seguintes. Isso cria momentos dramáticos: "seu oponente machucou o olho — ataque o clinch".

---

## 11. IA DO MUNDO (WORLDSERVICE)
**Responsável:** Especialista em IA de NPCs + Matchmaker

### O que já está excelente
- Promoções que controlam seus próprios eventos
- Seleção de oponentes OVR-window
- Ofertas de título via desafiante mandatório
- Sistema de tape (o mundo estuda você de volta)
- Decaimento de rivalidades

### Problemas identificados

#### P11.1 — IA nunca promove lutas estranhas
**O problema:** A IA sempre faz matchmaking sensato. No MMA real, promotores às vezes fazem lutas estranhas (desafiante descendo de peso, veterano vs prospect, luta que "não faz sentido").

**Solução proposta:** Adicionar um fator de "caos" no matchmaking da IA:
- 5% das lutas da IA são "experimentais" (pesos diferentes, estilos clash)
- 10% são "veterano vs prospect" (construção de novos talentos)
- A popularidade da promoção dita o quão conservadora ela é (mais popular = mais conservadora)

#### P11.2 — Ausência de drama nos eventos da IA
**O problema:** Lutas da IA são resolvidas e viram um resultado na lista. Não há:
- Lutas incríveis que viram notícia
- AZARES (underdog vence campeão)
- Lesões durante a luta que mudam trajectory

**Solução proposta:** Para eventos da IA, após simular, gerar 1-2 "headlines":
- "Fight of the Night" com quotes dos lutadores
- Resultados surpreendentes destacados
- Mudanças no ranking explicadas

---

## 12. PRIORIZAÇÃO DAS MELHORIAS

### Fase 1 — Impacto Imediato (menos esforço, maior retorno)
1. Momentos críticos na simulação de luta (P1.1)
2. Graduação do bônus por nível de scouting (P1.2)
3. Bônus pós-luta (FOTN/POTN) (P3.1)
4. Posição no card (P4.1)
5. Microdecisões de treino semanal (P2.1)
6. Eventos narrativos do CareerLog (P5.1)

### Fase 2 — Profundidade Estratégica
7. Recuperação de lesão em estágios (P2.2)
8. Ofertas short notice (P4.2)
9. Super fights e double champion (P4.3)
10. Sequela mecânica de lesões (P10.1)
11. Redes sociais contextuais (P6.1)
12. Histórias de bastidores (P5.2)

### Fase 3 — Polimento e Rejogabilidade
13. Onboarding guiado (P7.4)
14. Quebra do GameController (P8.2)
15. Modos desafio (P9.2)
16. Fim de carreira com escolhas (P5.3)
17. IA com fator caos (P11.1)
18. Eventos da IA com headlines (P11.2)

---

## 13. O QUE NÃO PRECISA MEXER

Alguns sistemas estão em excelente estado e devem ser preservados sem alteração:

- **Sistema de DNA oculto e auto-descoberta** — perfeito como está
- **O Livro Sobre Você (TapeService)** — mecânica inovadora e brilhante
- **Prontidão (ReadinessService)** — design elegante e comunicável
- **Cerimônia de aposentadoria** — documentário de carreira é um dos melhores momentos do jogo
- **Sistema de cinturões com interino** — completo e funcional
- **Sinergia técnico-atleta** — bem calibrada com ruído baixa sinergia
- **Osmose de treino** — mecânica única que gera histórias
- **Sistema de cores e design tokens** — identidade visual forte e consistente
- **Separação MVC** — arquitetura limpa que frameworks maiores copiariam

---

## 14. MÉTRICAS DE SUCESSO

Para cada melhoria implementada, o jogo deve ser avaliado contra:

1. **Diversão**: o jogador tem mais decisões interessantes para tomar?
2. **Profundidade**: as decisões têm consequências não-óbvias?
3. **Rejogabilidade**: uma segunda carreira é significativamente diferente?
4. **Imersão**: o mundo parece mais vivo?
5. **Clareza**: o jogador entende por que algo aconteceu?
6. **Impacto**: a mudança é perceptível ou só matemática?

---

*Documento gerado pelo Conselho de Especialistas em Desenvolvimento de Jogos.*
