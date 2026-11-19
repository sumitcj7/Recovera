const schema = require('../src/validators/deletionValidator');
test('requires canonical ObjectId values when requested', () => { expect(schema.safeParse({ collection: 'users', recordId: 'bad', identifierType: 'objectId' }).success).toBe(false); expect(schema.safeParse({ collection: 'users', recordId: '507f1f77bcf86cd799439011', identifierType: 'objectId' }).success).toBe(true); });
