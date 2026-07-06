# MMA Manager — War Room Simulator

**Assuma o comando de uma organização de MMA e transforme-a na maior potência do esporte.**

Contrate lutadores no mercado, negocie contratos, monte cards de tirar o fôlego, promova eventos ao vivo e administre cada dólar — enquanto rivais disputam os mesmos atletas e o mesmo público.

![Jogo em pt-BR](https://img.shields.io/badge/idioma-pt--BR-green) ![PWA](https://img.shields.io/badge/PWA-instal%C3%A1vel-blue) ![Sem backend](https://img.shields.io/badge/backend-nenhum-lightgrey)

## Por que este jogo vende

- **Loop de jogo viciante**: contratar → treinar → montar card → evento ao vivo → lucrar → expandir. Cada semana traz decisões com consequências reais.
- **Eventos como espetáculo**: a simulação é apresentada como uma transmissão ao vivo — luta a luta, com estatísticas de golpes, quedas e finalizações reveladas em tempo real.
- **Profundidade de simulação**: 9 divisões de peso, atributos ocultos (potencial, disciplina), DNA de lutador (cresce sob pressão, medo de grandes eventos), corte de peso, fadiga, moral, aposentadorias e nova safra anual de talentos.
- **Economia viva**: custos semanais que escalam com a reputação, bolsas e bônus de vitória, receita por público e fôlego de caixa — dá para quebrar.
- **Mundo reativo**: organizações rivais contratam seus alvos, rivalidades nascem de lutas acirradas, imprensa gera hype, Hall da Fama eterniza lendas.
- **Zero fricção**: roda em qualquer navegador, funciona offline (PWA instalável), salva automaticamente no dispositivo e exporta/importa saves em JSON. Sem servidor, sem custo de infraestrutura.

## Funcionalidades

| Tela | O que oferece |
|---|---|
| **Dashboard** | Arena 3D interativa, visão geral do caixa, reputação, objetivos e ranking de organizações |
| **Elenco / Mercado** | Contratações com negociação de bolsa, bônus e duração de contrato |
| **Eventos** | Criação de cards (principal + preliminares) com auto-matchmaking e simulação ao vivo |
| **Rankings** | Classificação oficial por divisão com campeões destacados |
| **Finanças** | Gráfico receita × despesa por evento, custos fixos semanais e fôlego de caixa |
| **Acampamento** | Treinos com intensidade e especialização, com risco de lesão |
| **Rivalidades** | Rivalidades dinâmicas que aumentam o hype (e a receita) dos confrontos |
| **Hall da Fama** | Indução automática por mérito: vitórias, streaks, popularidade |

## Como rodar

É um site estático — qualquer servidor HTTP serve:

```bash
# Python
python -m http.server 8341

# ou Node
npx serve .
```

Abra `http://localhost:8341`. Para distribuir, basta hospedar a pasta em qualquer host estático (GitHub Pages, Netlify, Vercel, itch.io como HTML5).

## Stack técnica

- **JavaScript puro (ES Modules)** — sem framework, sem build, sem dependência de npm
- **IndexedDB** para persistência local do save
- **Three.js** para a arena 3D e ambientação
- **GSAP + Lenis** para animações e scroll cinematográfico
- **PWA** com service worker (offline) e manifest (instalável)

## Caminhos de monetização

- **Premium/HTML5 portals**: itch.io, CrazyGames, Poki (jogos de gerenciamento têm público fiel e sessões longas)
- **Steam via wrapper** (Electron/Tauri) — a categoria "sports management" tem histórico forte de vendas
- **Mobile (PWA → loja)**: já é instalável; empacotar com Capacitor abre Google Play
- **Conteúdo**: passes de temporada com novas ligas, editor de lutadores, modos de carreira

## Roadmap sugerido

- [ ] Lutas título explícitas com cinturão em jogo
- [ ] Negociação de TV/patrocínios como fluxo de receita
- [ ] Árvore de upgrades da organização (academia, arena própria, olheiros)
- [ ] Localização en-US/es-ES para ampliar o mercado
- [ ] Trilha sonora e efeitos de som nos eventos
