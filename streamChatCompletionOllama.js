const https = require('https');
const http = require('http');
const chalk = require('chalk');

async function pullOllamaModels(models, verbose = false, hostname = 'localhost', port = 11434) {
  for (const model of models) {
    try {
      await pullOllamaModel(model, verbose, hostname, port);
      console.log(chalk.green(`Successfully pulled model: ${model}`));
    } catch (error) {
      console.error(chalk.red(`Failed to pull model ${model}:`, error.message));
    }
  }
}

async function pullOllamaModel(model, verbose = false, hostname = 'localhost', port = 11434) {
  console.log(chalk.blue(`Pulling model: ${model}`));

  const options = {
    hostname,
    port,
    path: '/api/pull',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    }
  };

  const requestData = {
    name: model
  };

  return new Promise((resolve, reject) => {
    const client = port === 443 ? https : http;
    const req = client.request(options, (res) => {
      if (verbose) console.log(chalk.cyan(`Status Code: ${res.statusCode}`));

      res.on('data', (chunk) => {
        const chunkStr = chunk.toString();
        try {
          const parsedChunk = JSON.parse(chunkStr);
          if (parsedChunk.status === "downloading") {
            const percentComplete = ((parsedChunk.completed / parsedChunk.total) * 100).toFixed(2);
            console.log(chalk.yellow(`Downloading ${model}: ${percentComplete}% complete`));
          }
          if (verbose) {
            console.log(chalk.yellow(JSON.stringify(parsedChunk)));
          }
        } catch (error) {
          if (verbose) console.error(chalk.red('Error parsing chunk:'), error);
        }
      });

      res.on('end', () => {
        if (verbose) console.log(chalk.green(`Pull request for model "${model}" completed.`));
        resolve();
      });
    });

    req.on('error', (error) => {
      if (verbose) console.error(chalk.red(`Error pulling model "${model}":`, error.message));
      reject(error);
    });

    req.write(JSON.stringify(requestData));
    req.end();
  });
}

async function streamChatCompletionOllama(model, prompt, temperature, verbose, hostname = 'localhost', port = 11434) {
  const options = {
    hostname,
    port,
    path: '/api/generate',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    }
  };

  const requestData = {
    model,
    prompt: prompt,
    options: {temperature: temperature},
    stream: true
  };

  let startTime = Date.now();
  let firstTokenTime = null;
  let totalTokens = 0;
  let output = '';
  let partialData = '';

  return new Promise((resolve, reject) => {
    const client = port === 443 ? https : http;
    const req = client.request(options, (res) => {
      if (verbose) console.log(chalk.cyan(`Status Code: ${res.statusCode}`));

      res.on('data', (chunk) => {
        const chunkStr = chunk.toString();
        partialData += chunkStr;

        let lastNewlineIndex;
        while ((lastNewlineIndex = partialData.lastIndexOf('\n')) !== -1) {
          const completeData = partialData.substring(0, lastNewlineIndex);
          partialData = partialData.substring(lastNewlineIndex + 1);

          completeData.split('\n').forEach(line => {
            if (line.trim()) {
              try {
                const parsed = JSON.parse(line);
                if (parsed.response) {
                  if (firstTokenTime === null) {
                    firstTokenTime = Date.now();
                  }
                  const content = parsed.response;
                  totalTokens += content.length;
                  output += content;
                  if (verbose) process.stdout.write(chalk.yellow(content));
                }
                if (parsed.done) {
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
                }
              } catch (error) {
                if (verbose) console.error(chalk.red('Error parsing JSON:'), error);
              }
            }
          });
        }
      });

      res.on('end', () => {
        if (partialData.trim()) {
          console.error(chalk.red('Incomplete JSON data at end of stream:'), partialData);
        }
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

module.exports = { streamChatCompletionOllama, pullOllamaModels };