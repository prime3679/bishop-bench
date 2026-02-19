const OpenAI = require('openai');
const client = new OpenAI({ apiKey: 'test' });
console.log(Object.keys(client));
try {
  console.log('client.responses:', client.responses);
} catch (e) {
  console.log('Error accessing client.responses:', e.message);
}
try {
  console.log('client.chat:', client.chat);
} catch (e) {
  console.log('Error accessing client.chat:', e.message);
}
