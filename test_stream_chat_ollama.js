const { streamChatCompletionOllama } = require('./stream_chat_completion_function');

async function testStreamChatOllama() {
  const model = 'llama3.1:8b';
  const prompt = 'Who is the president of France?';
  const temperature = 0.0;
  const verbose = true;

  try {
    console.log('Starting test for streamChatCompletionOllama...');
    const result = await streamChatCompletionOllama(model, prompt, temperature, verbose);
    
    console.log('\nTest completed. Results:');
    console.log('Output:', result.output);
    console.log('Time to first token:', result.timeToFirstToken, 'ms');
    console.log('Average tokens per second:', result.averageTokensPerSecond.toFixed(2));
  } catch (error) {
    console.error('An error occurred:', error);
  }
}

testStreamChatOllama();