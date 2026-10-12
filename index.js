import { Command } from 'commander';
import { readFileSync } from 'node:fs';

const program = new Command();

program
  .name('library')
  .description('CLI-програма для роботи з даними бібліотеки')
  .version('1.0.0')
  .option('-f, --file <path>', 'шлях до JSON-файлу', 'data.json');

function fail(message) {
  console.error(`Помилка: ${message}`);
  process.exit(1);
}

function load() {
  const path = program.opts().file;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') fail(`файл не знайдено: ${path}`);
    if (e instanceof SyntaxError) fail(`файл ${path} містить некоректний JSON`);
    fail(`не вдалося прочитати файл ${path}`);
  }
}

program.parse();

