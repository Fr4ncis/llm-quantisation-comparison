#!/usr/bin/env node
const http = require('http');
const { program } = require('commander');
const chalk = require('chalk');

function extractModelShortname(modelString) {
  const parts = modelString.split('/');
  return parts[parts.length - 1].replace('.gguf', '');
}

async function streamChatCompletion(model, messages, temperature, verbose) {
  const options = {
    hostname: '127.0.0.1',
    port: 1234,
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    }
  };

  const requestData = {
    model,
    messages,
    temperature,
    max_tokens: -1,
    stream: true
  };

  let startTime = Date.now();
  let firstTokenTime = null;
  let totalTokens = 0;
  let output = '';

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      if (verbose) console.log(chalk.cyan(`Status Code: ${res.statusCode}`));

      res.on('data', (chunk) => {
        const chunkStr = chunk.toString();
        const lines = chunkStr.split('\n');
        
        lines.forEach(line => {
          if (line.startsWith('data: ')) {
            const jsonData = line.slice(6);
            if (jsonData.trim() === '[DONE]') {
              if (verbose) console.log(chalk.green('\nStream finished.'));
              const endTime = Date.now();
              const timeToFirstToken = firstTokenTime - startTime;
              const totalTime = endTime - startTime;
              const tokensPerSecond = (totalTokens / totalTime) * 1000;
              
              resolve({
                output,
                timeToFirstToken,
                averageTokensPerSecond: tokensPerSecond
              });
            } else {
              try {
                const parsed = JSON.parse(jsonData);
                if (parsed.choices && parsed.choices[0].delta && parsed.choices[0].delta.content) {
                  if (firstTokenTime === null) {
                    firstTokenTime = Date.now();
                  }
                  const content = parsed.choices[0].delta.content;
                  totalTokens += content.length;
                  output += content;
                  if (verbose) process.stdout.write(chalk.yellow(content));
                }
              } catch (error) {
                if (verbose) console.error(chalk.red('Error parsing JSON:'), error);
              }
            }
          }
        });
      });
    });

    req.on('error', (error) => {
      if (verbose) console.error(chalk.red(`Error: ${error.message}`));
      reject(error);
    });

    req.write(JSON.stringify(requestData));
    req.end();
  });
}

async function main() {
  program
    .option('-v, --verbose', 'run in verbose mode')
    .parse(process.argv);

  const options = program.opts();
  const verbose = options.verbose || false;

  const models = [
    "lmstudio-community/gemma-2-2b-it-GGUF/gemma-2-2b-it-Q4_K_M.gguf",
    "lmstudio-community/gemma-2-2b-it-GGUF/gemma-2-2b-it-Q8_0.gguf",
    "lmstudio-community/gemma-2-2b-it-GGUF/gemma-2-2b-it-IQ3_M.gguf"
  ];

  const userPrompts = [
    "Introduce yourself.",
    "What is the capital of France?",
    "Explain the concept of artificial intelligence."
  ];

  for (const model of models) {
    const modelShortname = extractModelShortname(model);
    if (verbose) console.log(chalk.bgBlue.white(`\n========== Running model: ${modelShortname} ==========`));

    for (const prompt of userPrompts) {
      if (verbose) console.log(chalk.bgGreen.black(`\n----- Prompt: "${prompt}" -----`));
      try {
        const result = await streamChatCompletion(
          model,
          [
            { role: "system", content: "You are a helpful assistant." },
            { role: "user", content: prompt }
          ],
          0.0,
          verbose
        );

        console.log(chalk.blue(`Model: ${modelShortname}`));
        console.log(chalk.green(`Prompt: "${prompt}"`));
        console.log(chalk.magenta(`Time to first token: ${result.timeToFirstToken} ms`));
        console.log(chalk.cyan(`Average tokens/s: ${result.averageTokensPerSecond.toFixed(2)}`));
      } catch (error) {
        if (verbose) console.error(chalk.red('Error:'), error);
      }
    }
  }
}

main();