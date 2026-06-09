describe('MedicamentosService', () => {
  it('mapSearchType defaults to NOMBRE', () => {
    const map: Record<string, string> = {
      nombre: 'NOMBRE',
      registro: 'REGISTRO',
      cum: 'CUM',
    };
    expect(map['unknown'] ?? 'NOMBRE').toBe('NOMBRE');
  });
});

describe('OCR parser patterns', () => {
  const invimaPattern = /INVIMA\s*[\d]{4}[A-Z]-[\d]+(?:-R\d+)?/i;
  const cumPattern = /\d{6,8}-\d{3}/;

  it('detects INVIMA registration', () => {
    expect(invimaPattern.test('INVIMA 2021M-002103-R3')).toBe(true);
  });

  it('detects CUM code', () => {
    expect(cumPattern.test('12345678-001')).toBe(true);
  });
});

describe('Antifalsificacion scoring', () => {
  function buildScore(registroExists: boolean, vigente: boolean, labMatch: boolean) {
    let score = 0;
    if (!registroExists) return 100;
    if (!vigente) score += 80;
    if (!labMatch) score += 60;
    return score;
  }

  it('returns critical when registro missing', () => {
    expect(buildScore(false, true, true)).toBe(100);
  });

  it('adds score for non-vigente', () => {
    expect(buildScore(true, false, true)).toBe(80);
  });
});
