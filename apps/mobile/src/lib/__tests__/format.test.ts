import { firstName, formatIsoDate, formatMeasurement, maskDateInput, parseDecimal } from '../format';

describe('format helpers', () => {
  it('masks typed digits into YYYY-MM-DD', () => {
    expect(maskDateInput('1994')).toBe('1994');
    expect(maskDateInput('19940')).toBe('1994-0');
    expect(maskDateInput('19940512')).toBe('1994-05-12');
    expect(maskDateInput('1994-05-12-99')).toBe('1994-05-12');
  });

  it('formats dates and measurements for display', () => {
    expect(formatIsoDate('1994-05-12')).toBe('12 May 1994');
    expect(formatIsoDate(null)).toBeNull();
    expect(formatMeasurement(172.5, 'cm')).toBe('172.5 cm');
    expect(formatMeasurement(64, 'kg')).toBe('64 kg');
  });

  it('parses decimals typed with either separator', () => {
    expect(parseDecimal('72,5')).toBe(72.5);
    expect(parseDecimal('  ')).toBeNull();
    expect(parseDecimal('abc')).toBeNaN();
  });

  it('extracts a first name', () => {
    expect(firstName('Ada Lovelace Runner')).toBe('Ada');
  });
});
