const { spawnSync } = require('child_process');

if (!process.env.INTEGRATION_MONGODB_URI) {
  console.error('Set INTEGRATION_MONGODB_URI to a dedicated database, for example mongodb://localhost:27018/recovera_integration');
  process.exit(1);
}
if (!/\/recovera_integration(?:\?|$)/.test(process.env.INTEGRATION_MONGODB_URI)) {
  console.error('INTEGRATION_MONGODB_URI must use the dedicated recovera_integration database.');
  process.exit(1);
}
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const result = spawnSync(npm, ['run', 'test:integration', '-w', '@recovera/engine'], {
  stdio: 'inherit',
  env: { ...process.env, RUN_INTEGRATION: 'true', MONGODB_URI: process.env.INTEGRATION_MONGODB_URI },
});
process.exit(result.status || 1);
