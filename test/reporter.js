// Prints the test results in a short, readable way.
// Used by the "npm test" scripts in package.json.

const path = require('node:path');

const TITLES = {
  'task1.test.js': 'Task 1: Orders API',
  'task2.test.js': 'Task 2: Cache',
  'task3.test.js': 'Task 3: Job queue',
};

const useColor = !process.env.NO_COLOR && Boolean(process.stdout.isTTY || process.env.FORCE_COLOR);
const paint = (code) => (text) => (useColor ? `\x1b[${code}m${text}\x1b[0m` : text);
const green = paint(32);
const red = paint(31);
const yellow = paint(33);
const bold = paint(1);

const titleOf = (file) => TITLES[path.basename(file)] || path.basename(file);
const isTestFile = (name) => /\.test\.js$/.test(String(name));
// Node prints its own totals (tests 28, pass 12, ...). We print our own summary instead.
const isNodeTotal = (message) => /^(tests|suites|pass|fail|cancelled|skipped|todo|duration_ms) [\d.]+$/.test(message);

// Turns the error of a failed test into the lines we print under the test name.
function explain(error) {
  const cause = error && error.cause !== undefined ? error.cause : error;
  const message = String((cause && cause.message) || cause || 'unknown error');

  const neverFinished =
    (error && error.failureType === 'testTimeoutFailure') ||
    /^test timed out after/.test(message) ||
    /^Promise resolution is still pending/.test(message);
  if (neverFinished) {
    return ['The test did not finish.', 'Something is still waiting (for example a promise that never finishes).'];
  }

  if ((cause && cause.code === 'CHECK_FAILED') || message.startsWith('What the test did:')) {
    return message.split('\n').map((line) => {
      if (line.startsWith('Expected:')) return green(line);
      if (line.startsWith('Actual:')) return red(line);
      return line;
    });
  }

  // Any other error (for example a TypeError in the code): show it with the useful part of the stack.
  const stack = String((cause && cause.stack) || message)
    .split('\n')
    .filter((line) => !/\(node:|node_modules/.test(line))
    .slice(0, 8);
  return ['The test stopped because of this error:', ...stack];
}

module.exports = async function* reporter(source) {
  const results = new Map(); // title -> { passed, failed, broken }
  let currentTitle;

  const resultOf = (title) => {
    if (!results.has(title)) results.set(title, { passed: 0, failed: 0, broken: false });
    return results.get(title);
  };

  for await (const { type, data } of source) {
    // Output of the code itself (console.log, console.error).
    if (type === 'test:stdout' || type === 'test:stderr') {
      yield data.message;
      continue;
    }

    if (type === 'test:diagnostic') {
      if (isNodeTotal(data.message)) continue;
      // An error that no code caught, for example a rejected promise without a catch.
      const uncaught = /^Error: Test "(.*)" at .* generated asynchronous activity after the test ended\. This activity created the error "(.*)" and would have/s.exec(data.message);
      if (uncaught) {
        yield `${red(`✖ An error was not caught by any code: ${uncaught[2]}`)}\n\n`;
        yield `      It happened during or after the test "${uncaught[1]}".\n`;
        yield '      Often this is a rejected promise that has no catch.\n\n';
      } else {
        yield `${yellow(`Note: ${data.message}`)}\n`;
      }
      continue;
    }

    if (type !== 'test:pass' && type !== 'test:fail') continue;
    if (data.details && data.details.type === 'suite') continue;

    const file = data.file || (isTestFile(data.name) ? data.name : 'tests');
    const title = titleOf(file);
    const result = resultOf(title);

    if (title !== currentTitle) {
      currentTitle = title;
      yield `\n${bold(title)}\n${'-'.repeat(title.length)}\n`;
    }

    // The whole test file failed (for example a syntax error, or an error nobody caught).
    if (isTestFile(data.name)) {
      if (type === 'test:fail') {
        result.broken = true;
        yield `${red('✖ The test file stopped with an error. Look at the messages above.')}\n`;
      }
      continue;
    }

    if (type === 'test:pass') {
      result.passed++;
      yield `${green('✔')} ${data.name}\n`;
    } else {
      result.failed++;
      const lines = explain(data.details && data.details.error);
      yield `${red(`✖ ${data.name}`)}\n\n${lines.map((line) => `      ${line}`).join('\n')}\n\n`;
    }
  }

  yield `\n${bold('Summary')}\n-------\n`;
  const width = Math.max(...[...results.keys()].map((title) => title.length), 0);
  for (const [title, { passed, failed, broken }] of results) {
    const total = passed + failed;
    const allGood = failed === 0 && !broken && total > 0;
    let text = `${passed} of ${total} tests pass`;
    if (broken) text = total === 0 ? 'the tests could not run (see the error above)' : `${text}, but there was an error (see above)`;
    yield `${title.padEnd(width)}   ${allGood ? green(text) : red(text)}\n`;
  }
  yield '\n';
};
