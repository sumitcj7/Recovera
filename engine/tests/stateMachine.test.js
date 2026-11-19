const { assertTransition } = require('../src/utils/stateMachine');
test('permits only predictable verification-job transitions', () => { expect(() => assertTransition('queued', 'processing')).not.toThrow(); expect(() => assertTransition('completed', 'restoring')).toThrow('Invalid verification job transition'); });
