#!/usr/bin/env node
const { program } = require('commander');
const chalk = require('chalk');
const fs = require('fs');
const streamChatCompletion = require('./stream_chat_completion_function');
const { extractModelShortname } = require('./utils');

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

  const article001 = fs.readFileSync('article001.txt', 'utf-8');

  const userPrompts = [
    "What is the capital of France?",
    "Respond only with JSON, with a 'name' key. Who is the president of the US?",
    "Respond only with XML. What are the capitals of Europe?",
    "Respond only with the answer. What is the capital of the state of Washington in the US?",
    "Respond only with the answer. What language is 'ti voglio bene'?",
    "Classify the following text with positive, negative, neutral sentiment: 'The restaurant was too noisy'",
    `Summarise in one paragraph the following article '${article001}'`
  ];

  for (const model of models) {
    const modelShortname = extractModelShortname(model);
    if (verbose) console.log(chalk.bgBlue.white(`\n========== Running model: ${modelShortname} ==========`));

    for (const prompt of userPrompts) {
      if (verbose) console.log(chalk.bgGreen.black(`\n----- Prompt: "${prompt.slice(0, 100)}${prompt.length > 100 ? '...' : ''}" -----`));
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
        console.log(chalk.green(`Prompt: "${prompt.slice(0, 100)}${prompt.length > 100 ? '...' : ''}"`));
        console.log(chalk.magenta(`Time to first token: ${result.timeToFirstToken} ms`));
        console.log(chalk.cyan(`Average tokens/s: ${result.averageTokensPerSecond.toFixed(2)}`));
      } catch (error) {
        if (verbose) console.error(chalk.red('Error:'), error);
      }
    }
  }
}

main();