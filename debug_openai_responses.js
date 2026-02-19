const OpenAI = require('openai');
const client = new OpenAI({ apiKey: 'test' });
console.log('client.responses.create:', client.responses.create);
console.log('client.responses prototype keys:', Object.getOwnPropertyNames(Object.getPrototypeOf(client.responses)));
