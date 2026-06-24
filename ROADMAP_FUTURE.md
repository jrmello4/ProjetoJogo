# Roadmap Pós-MVP (Sistema Completo)

Estas seriam as expansões que transformariam o jogo em algo realmente profundo.

## ✅ 1. DNA Oculto dos Lutadores

Além dos atributos normais, cada lutador possui características invisíveis.

**Status: IMPLEMENTADO** ✅

Exemplos implementados:
- Cresce sob pressão (`pressurePerformer`)
- Sente medo em grandes eventos (`bigEventNervous`)
- Recuperação excepcional (`exceptionalRecovery`)
- Tendência a lesões (`injuryProne`)
- Instável emocionalmente (`emotionallyUnstable`)

Cada lutador recebe até 2 traits com probabilidades ponderadas. Afeta simulação de lutas, treino e conferencias de imprensa.

---

## ✅ 2. Sistema Completo de Camp de Treinamento

Antes de cada luta:

**Status: IMPLEMENTADO** ✅

O jogador escolhe:
- Intensidade (leve, moderado, intenso)
- Especialização (striking, grappling, cardio, chin)

Benefícios:
- Melhora atributos
- Corrige fraquezas

Riscos:
- Lesões (2%/8%/20% por intensidade)
- Overtraining (1%/5%/15% por intensidade)
- Queda de moral (no treino intenso)

DNA afeta: `injuryProne` dobra risco de lesão, `exceptionalRecovery` reduz pela metade, `emotionallyUnstable` aumenta overtraining 1.5x

---

## ✅ 3. Corte de Peso

Cada lutador possui:

**Status: IMPLEMENTADO** ✅

- Peso natural
- Peso competitivo
- Facilidade de corte (`ease`)

Impactos na simulação:
- Cardio reduzido
- Resistência afetada
- Potência alterada
- Recuperação pós-luta

---

## ❌ 4. Sistema Médico

Equipe médica própria.

**Status: NÃO IMPLEMENTADO** ❌

Profissionais planejados:
- Fisioterapeuta
- Médico esportivo
- Nutricionista

Afetaria:
- Recuperação
- Lesões
- Longevidade

**Nota:** O sistema de lesões já existe no camp de treinamento, mas sem equipe médica dedicada.

---

## ❌ 5. Academias Dinâmicas

Academias possuem:

**Status: NÃO IMPLEMENTADO** ❌

- Reputação
- Treinadores
- Estrutura
- Especialidades

Lutadores podem trocar de academia.
Academias podem crescer ou desaparecer.

---

## ❌ 6. Sistema de Scouts

Olheiros viajam pelo mundo.

**Status: NÃO IMPLEMENTADO** ❌

Descobrem:
- Prospectos
- Talentos escondidos
- Atletas olímpicos
- Ex-campeões regionais

**Nota:** O mercado de agentes livres já permite contratar lutadores aleatórios, mas sem sistema de scouting ativo.

---

## ❌ 7. Sistema de Regiões

Mercados independentes:

**Status: NÃO IMPLEMENTADO** ❌

- Brasil
- EUA
- Japão
- Rússia
- Reino Unido
- México

Cada mercado reage de forma diferente.

---

## ✅ 8. Popularidade e Fama

Separar:

**Status: IMPLEMENTADO** ✅

- Habilidade (OVR, atributos)
- Popularidade (0-100 com tiers: Novato, Desconhecido, Conhecido, Popular, Estrela, Superstar)

Nem sempre o melhor vende mais. Popularidade afeta receita de eventos e é calculada no ranking.

---

## ❌ 9. Redes Sociais

Cada lutador possui:

**Status: NÃO IMPLEMENTADO** ❌

- Seguidores
- Engajamento
- Carisma

Influenciam vendas e hype.

**Nota:** Popularidade já existe como base, mas sem mecânica de redes sociais.

---

## ✅ 10. Rivalidades

Memória permanente entre lutadores.

**Status: IMPLEMENTADO** ✅

Events:
- Provocações (geradas automaticamente pós-luta)
- Revanche (lutas próximas intensificam rivalidade)
- Sistema de intensidade (1-10, com labels: Leve, Moderada, Intensa, Fúria)
- Histórico de eventos (até 20 por rivalidade)
- Rivalidades ativas e inativas
- View dedicada com grid visual

---

## ✅ 11. Conferências de Imprensa

Sistema de escolhas.

**Status: IMPLEMENTADO** ✅

4 perguntas com 3 opções de resposta cada:
- Expectativas da luta
- Opinião sobre oponente
- Objetivos na organização
- Mensagem aos fãs

Cada resposta gera:
- Hype
- Moral
- Popularidade

DNA `emotionallyUnstable` amplifica efeitos em 1.5x.

**TODO:** Adicionar link no menu lateral e rota no `app.js` para acessar a view de conferencias de imprensa.

---

## ❌ 12. Sistema de Empresários

Empresários negociam:

**Status: NÃO IMPLEMENTADO** ❌

- Contratos
- Patrocínios
- Exigências

Cada um possui personalidade própria.

**Nota:** Contratos já existem (purse, duration, victory bonus), mas sem empresário dedicado.

---

## ❌ 13. Sistema de Patrocínio

Patrocinadores oferecem:

**Status: NÃO IMPLEMENTADO** ❌

- Dinheiro
- Metas
- Exigências

---

## ❌ 14. Sistema de Doping

Lutadores podem:

**Status: NÃO IMPLEMENTADO** ❌

- Ser pegos
- Ser suspensos
- Perder títulos

---

## ✅ 15. Sistema de Rankings Avançado

Leva em conta:

**Status: IMPLEMENTADO** ✅

- Qualidade da vitória (diferença de OVR)
- Streak (bônus de até +15)
- Popularidade (fator no cálculo)
- Força dos adversários (win rate e experiência)
- Campeões por divisão de peso

---

## ❌ 16. Live Fight Hub

Tela visual em tempo real.

**Status: NÃO IMPLEMENTADO** ❌

Mostra:
- Movimentação
- Golpes
- Grappling
- Dano
- Momentum

**Nota:** A simulação de lutas já existe mas é resolvida de forma numérica sem visualização em tempo real.

---

## ❌ 17. Sistema de Estratégia Durante a Luta

Instruções entre rounds:

**Status: NÃO IMPLEMENTADO** ❌

- Pressionar
- Defender
- Buscar queda
- Economizar energia

---

## ❌ 18. IA de Matchmaking

Organizações rivais criam eventos sozinhas.

**Status: NÃO IMPLEMENTADO** ❌

- Assinam atletas
- Criam rivalidades
- Tomam decisões estratégicas

---

## ❌ 19. Organizações Rivais

Talvez a feature mais importante após o MVP.

**Status: NÃO IMPLEMENTADO** ❌

Exemplos:
- Grandes ligas
- Organizações regionais
- Novas empresas

Competem por:
- Lutadores
- Patrocinadores
- Audiência

---

## ✅ 20. Sistema Moneyball

Analistas revelam:

**Status: PARCIALMENTE IMPLEMENTADO** ⚠️

O sistema de ranking já calcula:
- Lutadores subvalorizados (OVR alto, popularidade baixa)
- Matchups favoráveis (vantagens de estilo)
- Quality of victory

**Falta:** Interface dedicada de análise moneyball e analistas como mecânica de jogo.

---

## ✅ 21. Hall da Fama

Registro permanente.

**Status: IMPLEMENTADO** ✅

Inclui:
- Campeões (OVR 80+ com 50+ lutas ou #1 no ranking)
- Recordistas (50+ vitórias, 30+ vitórias, streaks)
- Lendas (OVR 90+, popularidade 90+)

Critérios de elegibilidade:
- 30+ vitórias
- OVR 80+ com 50+ lutas
- #1 no ranking

View dedicada com cards temáticos dourados.

---

## ❌ 22. Legado Histórico

O mundo continua por décadas.

**Status: NÃO IMPLEMENTADO** ❌

- Jogar 10, 20, 50 anos
- Novas gerações surgem
- Evolução temporal do meta

**Nota:** Evolução de atributos já existe, mas sem sistema de eras ou décadas.

---

## ❌ 23. Sistema de Eras

O meta do MMA muda ao longo do tempo.

**Status: NÃO IMPLEMENTADO** ❌

Exemplos:
- Era do Wrestling
- Era do BJJ
- Era dos Strikers
- Era dos All-Rounders

---

## ❌ 24. Sistema de Histórias Emergentes

O jogo cria automaticamente histórias como:

**Status: NÃO IMPLEMENTADO** ❌

- Filho de campeão
- Gênio indisciplinado
- Veterano ressurgindo
- Prospecto invicto
- Rivalidade histórica

**Nota:** DNA traits e rivalidades já criam narrativas implícitas, mas sem sistema de storytelling explícito.

---

## 🔧 ITENS ADICIONAIS IDENTIFICADOS

### TODO: Conferências de Imprensa sem Link de Acesso

A view e controller de conferencias de imprensa (`js/views/press-conference.js`, `js/controllers/press-conference.js`) estão completamente implementados, mas:
- Faltam link no menu lateral (`index.html`)
- Faltam rota no `app.js` (`navigateTo` switch)
- Faltam view import e render method no `app.js`

### Sugestão: Sistema de Temporadas

O jogo não tem conceito de tempo progressivo. Adicionar:
- Turnos/semanas que avançam
- Eventos agendados por data
- Temporadas com premiação anual

### Sugestão: Save/Load Explícito

Dados são persistidos em IndexedDB automaticamente, mas o jogador não tem:
- Múltiplos saves
- Export/import de save
- Reset de partida

### Sugestão: Notificações/Eventos do Dia

Sistema de notificações para:
- Mudanças de moral
- Recuperação de fadiga
- Novas rivalidades
- Elegibilidade para Hall da Fama
