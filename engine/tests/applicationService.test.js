jest.mock('../src/models/Application', () => ({ create: jest.fn(), find: jest.fn() }));
const bcrypt = require('bcryptjs');
const Application = require('../src/models/Application');
const service = require('../src/services/applicationService');
describe('application credentials', () => {
  beforeEach(() => jest.clearAllMocks());
  test('creates a strong one-time key and persists only a hash', async () => { Application.create.mockImplementation(async value => value); const result = await service.register({ name: 'Orders', databaseType: 'mongodb', environment: 'production' }); expect(result.apiKey).toMatch(/^rcv_live_/); expect(result.apiKey.length).toBeGreaterThan(40); expect(result.application.apiKeyHash).not.toBe(result.apiKey); expect(await bcrypt.compare(`${result.apiKey}development-only-change-me`, result.application.apiKeyHash)).toBe(true); });
  test('authenticates active matching credentials', async () => { const key = service.createApiKey(); const app = { status: 'active', apiKeyHash: await bcrypt.hash(`${key}development-only-change-me`, 4) }; Application.find.mockReturnValue({ select: jest.fn().mockResolvedValue([app]) }); await expect(service.authenticate(key)).resolves.toBe(app); });
  test('rejects invalid credentials', async () => { Application.find.mockReturnValue({ select: jest.fn().mockResolvedValue([]) }); await expect(service.authenticate('rcv_live_nope')).rejects.toMatchObject({ statusCode: 401 }); });
  test('does not consider suspended applications during authentication', async () => { Application.find.mockReturnValue({ select: jest.fn().mockResolvedValue([]) }); await expect(service.authenticate('rcv_live_suspended')).rejects.toMatchObject({ statusCode: 401 }); expect(Application.find).toHaveBeenCalledWith({ status: 'active' }); });
});
