const enabled = process.env.RUN_INTEGRATION === 'true';
const describeIntegration = enabled ? describe : describe.skip;
const fs = enabled ? require('fs') : null;
const path = enabled ? require('path') : null;
const { spawnSync } = enabled ? require('child_process') : {};
const request = enabled ? require('supertest') : null;
const mongoose = enabled ? require('mongoose') : null;
const Docker = enabled ? require('dockerode') : null;
const env = enabled ? require('../../src/config/env') : null;
const app = enabled ? require('../../src/app') : null;
const { connectDatabase, disconnectDatabase } = enabled ? require('../../src/config/database') : {};
const { verificationQueue } = enabled ? require('../../src/config/queue') : {};
const { createWorker } = enabled ? require('../../src/workers/verificationWorker') : {};
const VerificationJob = enabled ? require('../../src/models/VerificationJob') : null;
const VerificationReport = enabled ? require('../../src/models/VerificationReport') : null;

jest.setTimeout(180000);
const docker = enabled ? new Docker() : null;
const fixtureName = enabled ? `integration-${Date.now()}` : null;
const fixturePath = enabled ? path.join(env.BACKUP_STORAGE_ROOT, fixtureName) : null;
let sourceConnection;
let worker;

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', shell: false });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.stdout}`);
}
function sourceUri() {
  return env.MONGODB_URI.replace(/\/[^/?]+(\?.*)?$/, '/recovera_source_integration$1');
}
async function waitForJob(id) {
  const deadline = Date.now() + 150000;
  while (Date.now() < deadline) {
    const job = await VerificationJob.findById(id);
    if (['completed', 'failed'].includes(job?.status)) return job;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Verification job did not reach a terminal state');
}

describeIntegration('real isolated restoration', () => {
  beforeAll(async () => {
    expect(env.MONGODB_URI).toMatch(/\/recovera_integration(?:\?|$)/);
    run('docker', ['version']);
    run('mongodump', ['--version']);
    await connectDatabase();
    await Promise.all(Object.values(mongoose.connection.collections).map(collection => collection.deleteMany({})));
    sourceConnection = await mongoose.createConnection(sourceUri()).asPromise();
    await sourceConnection.dropDatabase();
    await sourceConnection.collection('users').insertMany([{ _id: 'USER_001', email: 'asha@example.test', name: 'Asha' }, { _id: 'USER_002', email: 'bikash@example.test', name: 'Bikash' }]);
    await sourceConnection.collection('orders').insertOne({ _id: 'ORDER_001', userId: 'USER_001' });
    run('mongodump', ['--uri', sourceUri(), '--out', fixturePath]);
    worker = createWorker({ workerId: `integration-${process.pid}` });
  });

  afterAll(async () => {
    if (worker) await worker.close();
    await verificationQueue.close();
    if (sourceConnection) await sourceConnection.dropDatabase().catch(() => {});
    if (sourceConnection) await sourceConnection.close();
    await disconnectDatabase();
    if (fixturePath.startsWith(`${env.BACKUP_STORAGE_ROOT}${path.sep}`)) await fs.promises.rm(fixturePath, { recursive: true, force: true });
  });

  test('restores a real BSON dump, verifies it, isolates applications, and cleans up containers', async () => {
    const first = await request(app).post('/api/v1/applications/register').send({ name: 'integration-a', databaseType: 'mongodb', environment: 'development' });
    const second = await request(app).post('/api/v1/applications/register').send({ name: 'integration-b', databaseType: 'mongodb', environment: 'development' });
    expect(first.status).toBe(201);
    const headers = { 'x-api-key': first.body.data.apiKey };
    const backup = await request(app).post('/api/v1/backups').set(headers).send({ name: 'real dump', backupLocation: fixtureName, backupFormat: 'dump', backupCreatedAt: new Date().toISOString(), metadata: { databaseName: 'recovera_source_integration' } });
    expect(backup.status).toBe(201);
    const isolated = await request(app).get(`/api/v1/backups/${backup.body.data._id}`).set('x-api-key', second.body.data.apiKey);
    expect(isolated.status).toBe(404);
    const queued = await request(app).post(`/api/v1/backups/${backup.body.data._id}/verify`).set(headers).send({ integrityChecks: [{ type: 'documentCount', collection: 'users', minimumDocuments: 2 }, { type: 'requiredFields', collection: 'users', fields: ['email', 'name'] }] });
    expect(queued.status).toBe(202);
    const job = await waitForJob(queued.body.data._id);
    expect(job.status).toBe('completed');
    const report = await VerificationReport.findById(job.reportId);
    expect(report.finalStatus).toBe('passed');
    const containers = await docker.listContainers({ all: true, filters: { label: ['recovera.managed=true', `recovera.worker-id=integration-${process.pid}`] } });
    expect(containers).toHaveLength(0);
  });
});
