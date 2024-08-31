#!/usr/bin/env node
const { program } = require('commander');
const chalk = require('chalk');
const fs = require('fs');
const streamChatCompletionLMStudio = require('./streamChatCompletionLMStudio.js');
const { streamChatCompletionOllama, pullOllamaModels } = require('./streamChatCompletionOllama.js');
const { extractModelShortname } = require('./utils');

async function main() {
  program
    .option('-v, --verbose', 'run in verbose mode')
    .option('-f, --function <type>', 'chat completion function to use (ollama or lmstudio)', 'lmstudio')
    .option('-h, --hostname <hostname>', 'hostname for the API server', '127.0.0.1')
    .option('-p, --port <port>', 'port for the API server', (val) => parseInt(val, 10))
    .option('-m, --models <models>', 'override default models (comma-separated)')
    .parse(process.argv);

  const options = program.opts();
  const verbose = options.verbose || false;
  const chatFunction = options.function.toLowerCase();
  const hostname = options.hostname;
  const port = options.port || (chatFunction === 'ollama' ? 11434 : 1234);

  if (chatFunction !== 'ollama' && chatFunction !== 'lmstudio') {
    console.error(chalk.red('Error: Invalid function specified. Use either "ollama" or "lmstudio".'));
    process.exit(1);
  }

  const streamChatCompletion = chatFunction === 'ollama' ? streamChatCompletionOllama : streamChatCompletionLMStudio;

  const defaultLmStudioModels = [
    "lmstudio-community/gemma-2-2b-it-GGUF/gemma-2-2b-it-Q8_0.gguf",
    ///"lmstudio-community/gemma-2-2b-it-GGUF/gemma-2-2b-it-IQ3_M.gguf",
    //"lmstudio-community/Phi-3.5-mini-instruct-GGUF/Phi-3.5-mini-instruct-Q4_K_M.gguf",
    //"lmstudio-community/Meta-Llama-3.1-8B-Instruct-GGUF/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf"
  ];

  const defaultOllamaModels = [
    "gemma2:2b-instruct-q2_K",
    "gemma2:2b-instruct-q4_K_M", 
    "gemma2:2b-instruct-q6_K",
    //"gemma2:2b-instruct-fp16",
  ];

  let models;
  if (options.models) {
    models = options.models.split(',').map(model => model.trim());
  } else {
    models = chatFunction === 'ollama' ? defaultOllamaModels : defaultLmStudioModels;
  }

  const article001 = fs.readFileSync('article001.txt', 'utf-8');

  const userPrompts = [
    "List all countries in EU, just the answer, comma separated values.",
    "Respond only with a JSON mapping where key is countries in EU and values is their capital.",
    "Write the key takeaways of 'The Missing Cryptoqueen'",
    "Who is James Hoffman?",
    "What is the capital of France?",
    "What is the capital of Portugal?",
    "What is Lisbon the capital of",
    "Respond only with JSON, with a 'name' key. Who is the president of the US?",
    "Respond only with XML. What are the capitals of Europe?",
    "Respond only with the answer. What is the capital of the state of Washington in the US?",
    "Respond only with the answer. What language is 'ti voglio bene'?",
    "Classify the following text with positive, negative, neutral sentiment: 'The restaurant was too noisy'",
    `Summarise in one paragraph the following article '${article001}'`,
    `For the article below, only respond with three hashtags that represent the content '${article001}'`
  ];

  const modelResults = {};

  if (chatFunction === 'ollama') {
    console.log(chalk.blue('Pulling Ollama models...'));
    await pullOllamaModels(models);
  }

  for (const model of models) {
    const modelShortname = extractModelShortname(model);
    if (verbose) console.log(chalk.bgBlue.white(`\n========== Running model: ${modelShortname} ==========`));

    modelResults[modelShortname] = {
      totalTimeToFirstToken: 0,
      totalAverageTokensPerSecond: 0,
      promptCount: 0
    };

    for (const prompt of userPrompts) {
      if (verbose) console.log(chalk.bgGreen.black(`\n----- Prompt: "${prompt.slice(0, 100)}${prompt.length > 100 ? '...' : ''}" -----`));
      try {
        const result = await streamChatCompletion(
          model,
          prompt,
          0.0,
          600,
          verbose,
          hostname,
          port
        );

        modelResults[modelShortname].totalTimeToFirstToken += result.timeToFirstToken;
        modelResults[modelShortname].totalAverageTokensPerSecond += result.averageTokensPerSecond;
        modelResults[modelShortname].promptCount++;

        if (verbose) {
          console.log(chalk.blue(`Model: ${modelShortname}`));
          console.log(chalk.green(`Prompt: "${prompt.slice(0, 100)}${prompt.length > 100 ? '...' : ''}"`));
          console.log(chalk.magenta(`Time to first token: ${result.timeToFirstToken} ms`));
          console.log(chalk.cyan(`Average tokens/s: ${result.averageTokensPerSecond.toFixed(2)}`));
        }
      } catch (error) {
        if (verbose) console.error(chalk.red('Error:'), error);
      }
    }
  }

  console.log(chalk.bgYellow.black('\n========== Final Results =========='));
  for (const [modelShortname, results] of Object.entries(modelResults)) {
    const avgTimeToFirstToken = results.totalTimeToFirstToken / results.promptCount;
    const avgTokensPerSecond = results.totalAverageTokensPerSecond / results.promptCount;

    console.log(chalk.blue(`Model: ${modelShortname}`));
    console.log(chalk.magenta(`Average Time to First Token: ${avgTimeToFirstToken.toFixed(2)} ms`));
    console.log(chalk.cyan(`Average Tokens/s: ${avgTokensPerSecond.toFixed(2)}`));
    console.log('');
  }
}

main();