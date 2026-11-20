const { abortError } = require('../src/services/dockerRestoreService');

test('uses a consistent operational error for cooperative cancellation', () => {
  expect(abortError()).toMatchObject({ code: 'VERIFICATION_TIMEOUT', statusCode: 504 });
});
