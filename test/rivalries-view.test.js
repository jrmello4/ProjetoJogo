import { describe, expect, it } from 'vitest';
import { RivalriesView } from '../js/views/rivalries.js';

describe('RivalriesView', () => {
  const fighters = [
    { id: 'a', name: 'Ana <script>' },
    { id: 'b', name: 'Bia' },
  ];

  it('keeps ended rivalries visible in the career archive', () => {
    const html = RivalriesView.render([], fighters, [{
      fighterAId: 'a', fighterBId: 'b', active: false, type: 'competitive',
      intensity: 3, intensityLabel: 'Morna', history: [{ description: 'Trilogia encerrada' }],
    }]);

    expect(html).toContain('Arquivo de Rivalidades Encerradas');
    expect(html).toContain('Trilogia encerrada');
    expect(html).toContain('Ana &lt;script&gt;');
  });

  it('renders a clear empty state without active or archived conflicts', () => {
    const html = RivalriesView.render([], fighters, []);
    expect(html).toContain('Nenhuma rivalidade ativa');
    expect(html).toContain('0 ativas');
  });
});
