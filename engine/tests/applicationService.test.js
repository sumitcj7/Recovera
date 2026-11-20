jest.mock('../src/models/Application', () => ({ create: jest.fn(), find: jest.fn(), findOne: jest.fn() }));
const bcrypt = require('bcryptjs');
const Application = require('../src/models/Application');
const service = require('../src/services/applicationService');
const env = require('../src/config/env');
describe('application credentials', () => {
  beforeEach(() => jest.clearAllMocks());
  test('creates an indexed key identifier and persists only a hash', async () => { Application.create.mockImplementation(async value => value); const result = await service.register({ name: 'Orders', databaseType: 'mongodb', environment: 'production' }); expect(result.apiKey).toMatch(/^rcv_live_[a-f0-9]{24}\./); expect(result.application.apiKeyId).toBe(service.getApiKeyId(result.apiKey)); expect(result.application.apiKeyHash).not.toBe(result.apiKey); expect(await bcrypt.compare(`${result.apiKey}${env.APP_KEY_PEPPER}`, result.application.apiKeyHash)).toBe(true); });
  test('authenticates a current key with one indexed application lookup', async () => { const key = service.createApiKey(); const app = { status: 'active', apiKeyHash: await bcrypt.hash(`${key}${env.APP_KEY_PEPPER}`, 4) }; Application.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(app) }); await expect(service.authenticate(key)).resolves.toBe(app); expect(Application.findOne).toHaveBeenCalledWith({ apiKeyId: service.getApiKeyId(key), status: 'active' }); expect(Application.find).not.toHaveBeenCalled(); });
  test('rejects invalid credentials', async () => { Application.find.mockReturnValue({ select: jest.fn().mockResolvedValue([]) }); await expect(service.authenticate('rcv_live_nope')).rejects.toMatchObject({ statusCode: 401 }); });
  test('does not consider suspended applications during legacy-key authentication', async () => { Application.find.mockReturnValue({ select: jest.fn().mockResolvedValue([]) }); await expect(service.authenticate('rcv_live_suspended')).rejects.toMatchObject({ statusCode: 401 }); expect(Application.find).toHaveBeenCalledWith({ status: 'active', apiKeyId: { $exists: false } }); });
});
