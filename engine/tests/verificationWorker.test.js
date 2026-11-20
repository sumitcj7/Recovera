jest.mock('../src/config/queue', () => ({ queueConnection: {} }));
const { isRestorationFailure } = require('../src/workers/verificationWorker');

describe('verification failure classification', () => {
  test('does not label post-restoration failures as restoration failures', () => {
    expect(isRestorationFailure({ restorationStatus: 'completed' })).toBe(false);
    expect(isRestorationFailure({ restorationStatus: 'running' })).toBe(true);
  });
});
