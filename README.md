# MMA Manager — Carreira de Lutador

**Você não é dono de academia. Você é o lutador — do primeiro contrato profissional até a aposentadoria.**

O mundo é simulado por baixo: promoções controladas pela IA realizam os próprios eventos, coroam campeões e mandam ofertas de luta. Você decide quais lutas aceitar, onde treinar, quanto investir em estudar o adversário — e, no meio do combate, o que gritar do córner.

![Jogo em pt-BR](https://img.shields.io/badge/idioma-pt--BR-green) ![Sem backend](https://img.shields.io/badge/backend-nenhum-lightgrey)

## O loop

**Preparar → contra-atacar → conquistar.**

1. Uma promoção oferece uma luta. Você aceita, recusa ou **negocia a bolsa**.
2. Você **estuda o adversário** — sem isso, os atributos dele são só faixas hachuradas e você escolhe o plano de jogo no escuro.
3. Você escolhe o **plano de jogo**. Manter em pé contra um grappler vale +10% por round; levá-lo ao chão custa −8%.
4. Na noite da luta, **você comanda o córner** entre os rounds.
5. Vencer os caras certos te coloca na **fila do cinturão** — não vencer muitos caras, os caras *certos*.

## O que já existe

| Sistema | O que faz |
|---|---|
| **Carreira de 1 lutador** | Sem elenco pra gerenciar — um personagem só, criado no onboarding (nome, categoria de peso, arquétipo, origem esportiva), até a aposentadoria |
| **DNA oculto, auto-descoberto** | Potencial, disciplina e traços como "trava nos grandes palcos" existem desde o dia 1, mas só se revelam aos poucos, através de eventos da carreira — nem o jogador vê os números de cara |
| **Mundo vivo** | 5 promoções de IA (regional → nacional → elite mundial) com calendário, elenco e eventos próprios |
| **Cinturões** | Campeão por divisão em cada promoção. A chance de título é do **desafiante mandatório**, não de quem empilhou vitórias |
| **Névoa de guerra** | Adversários são só o que você investigou — olheiro, scouting pago, ou "lutar contra alguém ensina de graça — tarde demais" |
| **Escolha de academia** | Sem dono de academia — você escolhe onde treinar, a qualquer momento. Academia grande tem treino melhor mas te trata como número; pequena cresce sinergia com o técnico mais rápido |
| **Empresário** | Negocia sua bolsa em troca de um corte. Agressivo abre portas mais cedo mas queima pontes com promoções; leal nunca te trai mas tem pior faro pra oportunidades |
| **Sinergia técnico-atleta** | Confiança no córner cresce seguindo o conselho e vencendo, cai ignorando e perdendo. Sinergia baixa pode virar sugestão errada no meio do round |
| **Córner ao vivo** | Instrução a cada round: pressionar, recuar, levar pro chão. Cada uma cobra fôlego ou expõe o queixo |
| **Psicologia de momento crítico** | Título, revanche, sequência em risco: a pressão sobe de verdade, e DNA como `bigEventNervous`/`pressurePerformer` responde a ela na pele |
| **Lesões com sequelas** | Lesão grave pode deixar marca permanente — teto de atributo reduzido pro resto da carreira, às vezes com um ganho mental compensando |
| **Custo de vida pessoal** | Subir o padrão de vida no auge sente bem, mas é compromisso semanal que continua existindo numa fase de baixa |
| **Patrocínios com cláusula de imagem** | Marca "limpa" paga bem mas cancela o contrato se você virar vilão demais; marca "vilão" exige que você mantenha o hype |
| **Redes sociais** | Provocar, pedir title shot ou ficar quieto — mesmo em semana livre, sua persona pública precede você em cada evento |
| **Rivalidades com origem** | Nascida de provocação (grudge), decisão polêmica (robbery) ou puro choque de ranking (competitive) — cada tipo muda o tom da imprensa e a pressão de uma revanche |
| **Arcos de rival no mundo** | Seu rival luta sem você no card: vitória dele vira manchete, esquenta a rivalidade e pode abrir um Momento da Carreira com nomes reais |
| **Octógono Talk (podcast)** | A cada 4 semanas, um episódio de talk-show reconta o career log e os arcos da semana — memória, não minigame |
| **Biografia viva** | Perfil, Hall da Fama e aposentadoria geram prosa só com fatos da carreira (rival, zebra, título, sequela) |
| **Torcida viva** | Persona face/heel (heat + popularidade), energia da arena, vaias/gritos e cartas de fãs após cada luta sua |
| **Comparação na mídia** | Card no dashboard: você vs rival mais quente (cartel, OVR, pop, confronto direto) |
| **Retrospectiva anual** | Fim de cada ano de jogo: documentário de temporada a partir do career log |
| **Biografias de campeões** | Cinturões no ranking mostram um verbete curto do dono do ouro — o mundo tem rostos |
| **Linha do tempo** | Perfil lista momentos marcantes (título, rival, torcida, viral…) |
| **Legado & documentário** | Na aposentadoria, sua carreira vira um documentário em capítulos — montado só com o que você viveu, sem roteiro escrito |
| **Simular período** | 1 mês a 1 ano em automático, com resumo agregado |

## Como rodar

```bash
node server.js 8341
```

Abra `http://localhost:8341`.

`server.js` envia `Cache-Control: no-store` em tudo — sem isso (ex.: `python -m
http.server`), o navegador cacheia módulos ES por heurística e um reload normal
pode servir um `.js` antigo **sem erro visível** depois de editar o arquivo.

## Stack

- **JavaScript puro (ES Modules)** — sem framework, sem build, sem npm
- **IndexedDB** para o save (migrações aditivas via `gameState.meta.patches`)
- **Three.js** na arena do pôster · **GSAP + Lenis** nas animações

## Design

Tema **"Red Corner / Blue Corner"**: o sistema de informação do próprio esporte vira o da interface. Vermelho é você, azul é o adversário, e ouro é só para cinturões. Tipografia `Archivo` (eixo de largura variável), `IBM Plex Sans` no corpo e `IBM Plex Mono` nos dados — um lutador lê cartéis e scorecards, não marketing.
