import { MONETIZATION_CONFIG, SPONSOR_BRANDS } from '../config/game-config.js';

// Slot de anúncio diegético — só aparece em pausas naturais (tela de
// "Simulando..." e no resumo pós-luta do Live Fight Hub), nunca no meio
// de uma decisão ou de um round. Ver nota grande em MONETIZATION_CONFIG
// (game-config.js) sobre as duas pernas da monetização real do jogo.
//
// Enquanto ADSENSE.enabled for false (padrão), o slot mostra uma placa de
// "patrocinador" com uma marca fictícia de SPONSOR_BRANDS — no espírito
// do próprio jogo, nunca fica vazio ou fora de tom. Ligar anúncio de
// verdade não muda onde o slot aparece, só o que renderiza dentro dele.
let _rotationIndex = Math.floor(Math.random() * SPONSOR_BRANDS.length);

export class AdService {
  static renderSlot(placement, idAttr) {
    const { enabled, publisherId, slotId } = MONETIZATION_CONFIG.ADSENSE;
    if (enabled && publisherId && slotId) {
      return `
        <div class="ad-slot ad-slot--${placement}" id="${idAttr}">
          <ins class="adsbygoogle"
               style="display:block"
               data-ad-client="${publisherId}"
               data-ad-slot="${slotId}"
               data-ad-format="auto"
               data-full-width-responsive="true"></ins>
        </div>`;
    }
    return AdService._renderFictionalSlot(placement, idAttr);
  }

  // Injeta o script do AdSense (uma vez só) e pede o preenchimento do
  // slot. Sem efeito nenhum enquanto ADSENSE.enabled for false.
  static mount(idAttr) {
    const { enabled, publisherId, slotId } = MONETIZATION_CONFIG.ADSENSE;
    if (!enabled || !publisherId || !slotId || !document.getElementById(idAttr)) return;

    if (!document.getElementById('adsbygoogle-script')) {
      const script = document.createElement('script');
      script.id = 'adsbygoogle-script';
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisherId}`;
      document.head.appendChild(script);
    }
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // Rede de anúncio ainda carregando o script — silencioso, não é erro
      // do jogador nem deve poluir o console dele.
    }
  }

  static _renderFictionalSlot(placement, idAttr) {
    const brand = SPONSOR_BRANDS[_rotationIndex % SPONSOR_BRANDS.length];
    _rotationIndex++;
    return `
      <div class="ad-slot ad-slot--${placement} ad-slot--fictional" id="${idAttr}">
        <span class="ad-slot-eyebrow">Patrocinado por</span>
        <span class="ad-slot-brand">${brand.name}</span>
      </div>`;
  }
}
