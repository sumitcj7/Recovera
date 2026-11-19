const pino = require('pino');
const env = require('./env');
module.exports = pino({ level: env.LOG_LEVEL, redact: ['req.headers.x-api-key', 'req.headers.authorization', 'apiKey', 'apiKeyHash'] });
