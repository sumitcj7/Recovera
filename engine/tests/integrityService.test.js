jest.mock('../src/services/dockerRestoreService', () => ({ exec: jest.fn() }));
const { exec } = require('../src/services/dockerRestoreService'); const { verify } = require('../src/services/integrityService');
const output = value => ({ stdout: `${JSON.stringify(value)}\n` });
describe('integrity verification', () => {
  beforeEach(() => jest.resetAllMocks());
  test('reports a passing document-count and required-fields check without returning documents', async () => { exec.mockResolvedValueOnce(output(['admin', 'orders'])).mockResolvedValueOnce(output(['users'])).mockResolvedValueOnce(output(4)).mockResolvedValueOnce(output(['users'])).mockResolvedValueOnce(output(true)).mockResolvedValueOnce(output(true)); const result = await verify({}, [{ type: 'documentCount', collection: 'users', minimumDocuments: 3 }, { type: 'requiredFields', collection: 'users', fields: ['email', 'name'] }], 'orders'); expect(result.status).toBe('passed'); expect(result.checks[0].actual).toBe(4); expect(result.checks[1].actual).toEqual({ missing: [] }); });
  test('keeps restoration distinct when a collection is missing', async () => { exec.mockResolvedValueOnce(output(['orders'])).mockResolvedValueOnce(output([])); const result = await verify({}, [{ type: 'collectionExists', collection: 'users' }], 'orders'); expect(result.status).toBe('failed'); expect(result.checks[0].finding).toBe('Collection is missing'); });
});
