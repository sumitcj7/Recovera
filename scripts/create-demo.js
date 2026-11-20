const { spawnSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');
const backupName = process.argv[2] || 'demo-backup-v1';
const script = `
const demo = db.getSiblingDB('demo');
demo.users.deleteMany({}); demo.products.deleteMany({}); demo.orders.deleteMany({});
demo.users.insertMany([{_id:'USER_001',name:'Asha',email:'asha@example.test'},{_id:'USER_002',name:'Bikash',email:'bikash@example.test'}]);
demo.products.insertOne({_id:'PRODUCT_001',name:'Recovery Plan',price:99});
demo.orders.insertOne({_id:'ORDER_001',userId:'USER_001',productId:'PRODUCT_001'});
`;
function run(command, args) { const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' }); if (result.status !== 0) process.exit(result.status || 1); }
run('docker', ['compose', 'exec', '-T', 'mongo', 'mongosh', '--quiet', '--eval', script]);
run('mongodump', ['--uri', 'mongodb://localhost:27018/demo', '--out', path.join(root, 'backups', backupName)]);
console.log(`Demo backup created at backups/${backupName}`);
