import { Command } from 'commander';
import { readFileSync } from 'node:fs';

const program = new Command();

program
  .name('survey')
  .description('CLI-програма для роботи з даними опитування')
  .version('1.0.0')
  .option('-f, --file <path>', 'шлях до JSON-файлу', 'data.json');

function fail(message) {
  console.error(`Помилка: ${message}`);
  process.exit(1);
}

function load() {
  const path = program.opts().file;
  let data;
  try {
    data = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') fail(`файл не знайдено: ${path}`);
    if (e instanceof SyntaxError) fail(`файл ${path} містить некоректний JSON`);
    fail(`не вдалося прочитати файл ${path}`);
  }
  if (!Array.isArray(data.questions) || !Array.isArray(data.respondents)) {
    fail('у файлі мають бути масиви "questions" і "respondents"');
  }
  return data;
}

function parseId(value, what) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) fail(`${what} має бути додатним цілим числом`);
  return n;
}

function findRespondent(data, idStr) {
  const id = parseId(idStr, 'id респондента');
  const r = data.respondents.find((x) => x.id === id);
  if (!r) fail(`респондента з id ${id} не знайдено`);
  return r;
}

function findQuestion(data, idStr) {
  const id = parseId(idStr, 'id питання');
  const q = data.questions.find((x) => x.id === id);
  if (!q) fail(`питання з id ${id} не знайдено`);
  return q;
}

// Значення відповіді для виводу: null і порожній масив - це "немає відповіді".
function formatValue(value) {
  if (value === null || value === undefined) return '(без відповіді)';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '(без відповіді)';
  return String(value);
}

// ---------- Загальні можливості ----------

program
  .command('list')
  .description('Показати перелік респондентів')
  .option('-l, --limit <n>', 'максимальна кількість записів')
  .action((opts) => {
    const { respondents } = load();
    let n = respondents.length;
    if (opts.limit !== undefined) n = parseId(opts.limit, '--limit');
    respondents.slice(0, n).forEach((r) => {
      console.log(`${r.id}\t${r.name}\t${r.submittedAt}`);
    });
  });

program
  .command('show <id>')
  .description('Показати одного респондента повністю')
  .action((id) => {
    console.log(JSON.stringify(findRespondent(load(), id), null, 2));
  });

program
  .command('field <id> <path>')
  .description('Показати поле респондента (вкладене - через крапку, напр. contact.city)')
  .action((id, path) => {
    let value = findRespondent(load(), id);
    for (const key of path.split('.')) {
      if (value === null || typeof value !== 'object' || !Object.hasOwn(value, key)) {
        fail(`поле "${path}" відсутнє у респондента ${id}`);
      }
      value = value[key];
    }
    console.log(value === null ? 'null' : JSON.stringify(value, null, 2));
  });

// ---------- Можливості варіанта 7 ----------

program
  .command('questions')
  .description('Перелік питань з відбором за обов\'язковістю та типом')
  .option('-r, --required', 'лише обов\'язкові питання')
  .option('-o, --optional', 'лише необов\'язкові питання')
  .option('-t, --type <type>', 'лише питання вказаного типу (scale, single, multiple, text)')
  .action((opts) => {
    if (opts.required && opts.optional) fail('опції --required і --optional взаємовиключні');
    const { questions } = load();
    if (opts.type !== undefined && !questions.some((q) => q.type === opts.type)) {
      const known = [...new Set(questions.map((q) => q.type))].join(', ');
      fail(`невідомий тип "${opts.type}" (наявні: ${known})`);
    }
    let result = questions;
    if (opts.required) result = result.filter((q) => q.required === true);
    if (opts.optional) result = result.filter((q) => q.required === false);
    if (opts.type) result = result.filter((q) => q.type === opts.type);
    if (result.length === 0) {
      console.log('За заданими умовами питань немає.');
      return;
    }
    result.forEach((q) => {
      console.log(`${q.id}\t${q.type}\t${q.required ? "обов'язкове" : "необов'язкове"}\t${q.text}`);
    });
  });

program
  .command('answers <questionId>')
  .description('Відповіді всіх респондентів на обране питання')
  .action((questionId) => {
    const data = load();
    const q = findQuestion(data, questionId);
    console.log(`Питання ${q.id}: ${q.text}`);
    data.respondents.forEach((r) => {
      const ans = r.answers.find((a) => a.questionId === q.id);
      console.log(`${r.id}\t${r.name}\t${formatValue(ans ? ans.value : null)}`);
    });
  });

program
  .command('respondent <id>')
  .description('Усі відповіді одного респондента разом із текстом питань')
  .action((id) => {
    const data = load();
    const r = findRespondent(data, id);
    console.log(`Респондент ${r.id}: ${r.name}`);
    data.questions.forEach((q) => {
      const ans = r.answers.find((a) => a.questionId === q.id);
      console.log(`${q.id}. ${q.text}\n   -> ${formatValue(ans ? ans.value : null)}`);
    });
  });

program.parse();
