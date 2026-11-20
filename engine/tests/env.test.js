const { isSecurePepper } = require('../src/config/env');
describe('environment security', () => {
  test('rejects known placeholder and short peppers', () => { expect(isSecurePepper('replace-with-a-long-random-secret')).toBe(false); expect(isSecurePepper('short')).toBe(false); });
  test('accepts a non-placeholder pepper with enough entropy material', () => { expect(isSecurePepper('local-development-secret-that-is-longer-than-32')).toBe(true); });
});
