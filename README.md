# MMA Manager — Modo Treinador

**Você é o dono e treinador de uma academia de MMA. Três atletas desconhecidos. Nenhum cinturão.**

As promoções são controladas pela IA: elas realizam os próprios eventos, coroam campeões e mandam ofertas de luta para os seus atletas. Você decide quais lutas aceitar, o que cada um treina, quanto investir em estudar o adversário — e, no meio do combate, o que gritar do córner.

![Jogo em pt-BR](https://img.shields.io/badge/idioma-pt--BR-green) ![PWA](https://img.shields.io/badge/PWA-instal%C3%A1vel-blue) ![Sem backend](https://img.shields.io/badge/backend-nenhum-lightgrey)

> 📋 **O que falta construir está em [`docs/PRD.md`](docs/PRD.md)** — fonte de verdade do roadmap, dos bugs conhecidos e das convenções do projeto.
>
> Os arquivos `ROADMAP_FUTURE.md` e `TODO_REMAINING.md` descrevem o antigo *modo organização* e estão **superados**.

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
| **Mundo vivo** | 5 promoções de IA (regional → nacional → elite mundial) com calendário e eventos próprios |
| **Cinturões** | Campeão por divisão em cada promoção. A chance de título é do **desafiante mandatório**, não de quem empilhou vitórias |
| **Névoa de guerra** | Você conhece seus atletas por inteiro; de quem está de fora, só o que investigou. Olheiro, scouting pago, e "lutar contra alguém ensina de graça — tarde demais" |
| **Plano de jogo** | 5 planos que leem o adversário. A leitura pesa mais que a instrução de córner |
| **Córner ao vivo** | Instrução a cada round: pressionar, recuar, levar pro chão. Cada uma cobra fôlego ou expõe o queixo |
| **Suspensão médica** | Ninguém luta toda semana. 1 a 16 semanas conforme a violência do desfecho |
| **Academia** | Instalações (4 níveis), comissão técnica, olheiro, patrocínios, extrato financeiro |
| **Academias rivais** | Disputam os mesmos agentes livres e seduzem seus atletas insatisfeitos |
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
- **PWA** instalável e offline

## Design

Tema **"Red Corner / Blue Corner"**: o sistema de informação do próprio esporte vira o da interface. Vermelho é sua academia, azul é o adversário, e ouro é só para cinturões. Tipografia `Archivo` (eixo de largura variável), `IBM Plex Sans` no corpo e `IBM Plex Mono` nos dados — um treinador lê cartéis e scorecards, não marketing.

Convenções críticas (contraste, animação, tokens) estão documentadas no [PRD](docs/PRD.md#0-como-usar-este-documento).
