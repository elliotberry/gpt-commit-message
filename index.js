#!/usr/bin/env nod
import { Configuration, OpenAIApi } from "openai";
import prompts from 'prompts';


import { exec as originalExec } from 'child_process';

import { estimate, Operation, CompletionModel } from 'openai-gpt-cost-estimator'



let apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('OPENAI_API_KEY environment variable is not set.');
  process.exit(1);
}
const exec = async function (cmd) {
  return new Promise(function (res, rej) {
    originalExec(cmd, (error, stdout, stderr) => {
          if (error) {
              console.error(`error: ${error.message}`)
              rej(error)
          }
          if (stderr) {
              console.error(`stderr: ${stderr}`)
              rej(stderr)
          }

          res(stdout)
      })
  })
}

async function getGitSummary() {
  try {

    const stdout = await exec(`cd ${process.cwd()} && git diff --cached --stat`);
    const summary = stdout.trim();

    if (summary.length === 0) {
      return null;
    }

    return summary;
  } catch (error) {
    console.error('Error while summarizing Git changes:', error);
    process.exit(1);
  }
}

const main = async() => {
  const gitSummary = await getGitSummary();

  if (!gitSummary) {
    console.log('No changes to commit. Commit canceled.');
    process.exit(0);
  }
  const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  });
 
  const prompt = `Generate a succinct summary of the following code changes, with as much detail aas possible, using no more than 50 characters:\n\n`;
  
const config = {
  operation: Operation.COMPLETION,
  model: CompletionModel.DAVINCI,
  prompt,
  n: 3,
  bestOf: 5,
  maxTokens: 32
}
const result = estimate(config)

const confirm1 = await prompts({
    type: 'confirm',
    name: 'value',
    message:  `Estimated cost: "${result.totalCostDisplay}" (${result.completionTokens} tokens). Do you want to continue?`,
    initial: false
  });
  if (!confirm1.value) {
    console.log('Commit canceled.');
    process.exit(0);
    }

  const openai = new OpenAIApi(configuration);
 // let tokens = count(prompt);
    console.log(result);
 const response = await openai.createChatCompletion({
    model: "gpt-3.5-turbo-16k-0613",
   // prompt: prompt,
   "messages": [{"role": "user", "content": `please write a git commit, given this git diff: \n\n${gitSummary}`}],
    max_tokens: 50,
    n: 1,
    stop: null,
    temperature: 0.5,
  });

  const message = response.data.choices[0].message.content.trim();

  const confirm = await prompts({
    type: 'confirm',
    name: 'value',
    message: `Suggested commit message: "${message}". Do you want to use it?`,
    initial: true,
  });

  if (confirm.value) {
    let res = await exec(`git commit -m "${message}"`);
    console.log(res);
    console.log('Committed with the suggested message.');
  } else {
    console.log('Commit canceled.');
  }
};

main();