import { PixelIcon } from './pixel-icon.js';

export class LegalView {
  static render() {
    return `
      <div class="page-header">
        <h2>${PixelIcon.render('settings', { size: 'lg' })} Privacidade e termos</h2>
        <p>Informações claras sobre dados, uso do jogo e apoio opcional.</p>
      </div>

      <section class="card mb-4" data-reveal>
        <div class="card-header"><span class="card-title">Aviso de privacidade</span></div>
        <p class="text-sm"><strong>Como esta versão funciona:</strong> MMA Manager não cria conta nem possui servidor de saves. Carreiras, lutadores e mundo simulado ficam no IndexedDB; tema, áudio, acessibilidade e preferências ficam no armazenamento local do navegador.</p>
        <div class="table-container legal-data-table mt-2">
          <table>
            <thead><tr><th>Dado local</th><th>Finalidade</th><th>Como remover</th></tr></thead>
            <tbody>
              <tr><td data-label="Dado local">Save da carreira</td><td data-label="Finalidade">Executar e restaurar o jogo</td><td data-label="Como remover">Resetar o jogo ou limpar os dados do site</td></tr>
              <tr><td data-label="Dado local">Preferências</td><td data-label="Finalidade">Lembrar tema, som e acessibilidade</td><td data-label="Como remover">Resetar ou limpar o armazenamento do site</td></tr>
              <tr><td data-label="Dado local">Cache offline</td><td data-label="Finalidade">Abrir a versão instalada sem internet</td><td data-label="Como remover">Desinstalar o PWA ou limpar cache/dados do site</td></tr>
              <tr><td data-label="Dado local">Backup exportado</td><td data-label="Finalidade">Cópia escolhida pelo jogador</td><td data-label="Como remover">Apagar o arquivo no próprio aparelho</td></tr>
            </tbody>
          </table>
        </div>
        <p class="text-sm mt-2">O jogo não recebe, comercializa ou compartilha esses dados locais. Não usa cookies de publicidade, analytics, conta, localização, contatos, câmera ou microfone. Um nome digitado para o lutador pode ser pessoal; ele continua no aparelho enquanto você não o exportar.</p>
        <p class="text-sm mt-2">Você controla acesso, correção, portabilidade e eliminação diretamente: edite o que o jogo permitir, exporte o backup ou apague os dados. A LGPD reconhece direitos como confirmação, acesso, correção, portabilidade e eliminação; consulte a <a href="https://www.gov.br/mma/pt-br/acesso-a-informacao/lei-geral-de-protecao-de-dados-pessoais-lgpd" target="_blank" rel="noopener noreferrer">orientação oficial sobre a LGPD</a>.</p>
      </section>

      <section class="card mb-4" data-reveal>
        <div class="card-header"><span class="card-title">Serviços externos</span></div>
        <p class="text-sm">O Ko-fi só é aberto quando você ativa o link de apoio. A partir daí, a navegação, eventual conta e pagamento acontecem fora do MMA Manager e seguem a <a href="https://more.ko-fi.com/privacy" target="_blank" rel="noopener noreferrer">política de privacidade do Ko-fi</a>, seus termos e as regras do processador de pagamento escolhido. O jogo não recebe seus dados de pagamento.</p>
        <p class="text-sm mt-2">Links externos são identificados e abrem em outra aba. Revise as políticas do destino antes de fornecer dados. Futuras integrações de nuvem, analytics, anúncios ou conta exigirão atualização deste aviso antes de serem ativadas.</p>
      </section>

      <section class="card mb-4" data-reveal>
        <div class="card-header"><span class="card-title">Termos de uso e licença</span></div>
        <p class="text-sm">Este é um jogo de ficção e entretenimento. Resultados, atletas, promoções e decisões não são aconselhamento médico, financeiro, jurídico ou de treinamento de combate.</p>
        <p class="text-sm mt-2">Você recebe licença pessoal, limitada, revogável, não exclusiva e intransferível para jogar a versão publicada. Pode compartilhar seus próprios resultados e manter backups pessoais. Não pode vender, republicar, remover créditos, extrair assets para outro produto, distribuir cópia modificada como oficial ou usar o jogo em atividade ilegal.</p>
        <p class="text-sm mt-2">Nomes, personagens e organizações simuladas são fictícios. Eventual semelhança não implica afiliação ou endosso. Marcas e conteúdos de terceiros permanecem de seus titulares e são usados somente conforme as licenças incluídas no projeto.</p>
        <p class="text-sm mt-2">O software é fornecido no estado disponível. Embora haja testes e backups, não se promete operação sem falhas ou compatibilidade eterna com todo navegador. A responsabilidade não é excluída onde a lei não permitir; exporte um backup antes de limpar dados, trocar de navegador ou instalar atualização importante.</p>
      </section>

      <section class="card mb-4" data-reveal>
        <div class="card-header"><span class="card-title">Contato e apoio</span></div>
        <p class="text-sm">Canal do projeto para dúvidas sobre privacidade, termos e apoio opcional: <a href="https://ko-fi.com/jmello03" target="_blank" rel="noopener noreferrer">ko-fi.com/jmello03</a>. Informe que a solicitação trata do MMA Manager e não envie save ou outro dado pessoal sem necessidade.</p>
        <p class="text-xs text-muted mt-2">Última atualização: 23 de julho de 2026. Este texto descreve a versão atual local/offline do jogo e não substitui uma revisão jurídica profissional para distribuição comercial.</p>
      </section>

      <button class="btn btn-secondary" type="button" data-legal-back>Voltar às configurações</button>
    `;
  }
}
