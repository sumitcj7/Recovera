jest.mock('../src/models/VerificationJob', () => ({ create: jest.fn(), deleteOne: jest.fn(), find: jest.fn() }));
jest.mock('../src/models/VerificationReport', () => ({}));
jest.mock('../src/services/backupService', () => ({ get: jest.fn() }));
jest.mock('../src/config/queue', () => ({ verificationQueue: { add: jest.fn(), getJob: jest.fn() } }));
const VerificationJob = require('../src/models/VerificationJob');
const backupService = require('../src/services/backupService');
const { verificationQueue } = require('../src/config/queue');
const service = require('../src/services/verificationJobService');

describe('verification queue reliability', () => {
  beforeEach(() => jest.clearAllMocks());
  test('rejects duplicate active verification creation', async () => {
    backupService.get.mockResolvedValue({});
    VerificationJob.create.mockRejectedValue({ code: 11000 });
    await expect(service.enqueue('app-a', 'backup-a', {})).rejects.toMatchObject({ code: 'VERIFICATION_ALREADY_IN_PROGRESS', statusCode: 409 });
  });
  test('removes an unqueued job when queue submission fails', async () => {
    backupService.get.mockResolvedValue({});
    VerificationJob.create.mockResolvedValue({ _id: 'job-a', save: jest.fn() });
    verificationQueue.add.mockRejectedValue(new Error('Redis unavailable'));
    await expect(service.enqueue('app-a', 'backup-a', {})).rejects.toMatchObject({ code: 'QUEUE_UNAVAILABLE', statusCode: 503 });
    expect(VerificationJob.deleteOne).toHaveBeenCalledWith({ _id: 'job-a' });
  });
  test('releases the active-job key at a terminal transition', async () => {
    const job = { status: 'processing', activeJobKey: 'app-a:backup-a', save: jest.fn() };
    await service.transition(job, 'failed');
    expect(job.activeJobKey).toBeUndefined();
  });
});
