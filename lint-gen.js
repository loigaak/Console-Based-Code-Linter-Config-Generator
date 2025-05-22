#!/usr/bin/env node

const { program } = require('commander');
const inquirer = require('inquirer');
const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

// Templates storage
const TEMPLATES_DIR = path.join(process.env.HOME || process.env.USERPROFILE, '.lint_gen_templates.json');

// Default linter configs
const configs = {
  eslint: {
    js: {
      files: {
        '.eslintrc.json': JSON.stringify({
          env: { browser: true, es2021: true, node: true },
          extends: ['standard'],
          parserOptions: { ecmaVersion: 12, sourceType: 'module' },
          rules: { 'semi': ['error', 'always'], 'quotes': ['error', 'single'] },
        }, null, 2),
        '.eslintignore': 'node_modules\ncoverage\n',
      },
      dependencies: ['eslint', 'eslint-config-standard'],
    },
    react: {
      files: {
        '.eslintrc.json': JSON.stringify({
          env: { browser: true, es2021: true },
          extends: ['plugin:react/recommended', 'standard'],
          parserOptions: { ecmaVersion: 12, sourceType: 'module' },
          plugins: ['react'],
          rules: { 'react/prop-types': 'off', 'semi': ['error', 'always'] },
        }, null, 2),
        '.eslintignore': 'node_modules\ncoverage\nbuild\n',
      },
      dependencies: ['eslint', 'eslint-config-standard', 'eslint-plugin-react'],
    },
  },
  prettier: {
    default: {
      files: {
        '.prettierrc': JSON.stringify({
          semi: true,
          trailingComma: 'es5',
          singleQuote: true,
          printWidth: 80,
          tabWidth: 2,
        }, null, 2),
        '.prettierignore': 'node_modules\ncoverage\nbuild\n',
      },
      dependencies: ['prettier'],
    },
  },
};

// Install dependencies
function installDependencies(deps) {
  try {
    console.log(chalk.blue('Installing dependencies...'));
    execSync(`npm install ${deps.join(' ')} --save-dev`, { stdio: 'inherit' });
    console.log(chalk.green('Dependencies installed successfully!'));
  } catch (error) {
    console.log(chalk.red('Failed to install dependencies. Please install manually.'));
  }
}

// Generate config files
async function generateConfig(type, options) {
  let config;
  if (type === 'eslint') {
    config = configs.eslint[options.type || 'js'];
  } else if (type === 'prettier') {
    config = configs.prettier.default;
  } else {
    console.log(chalk.red(`Unsupported config type: ${type}`));
    return;
  }

  if (!config) {
    console.log(chalk.red(`Invalid config type for ${type}: ${options.type}`));
    return;
  }

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Generate ${type} config for ${options.type || 'default'}?`,
      default: true,
    },
  ]);

  if (!confirm) return;

  for (const [file, content] of Object.entries(config.files)) {
    const filePath = path.join(process.cwd(), file);
    await fs.outputFile(filePath, content);
    console.log(chalk.green(`Created ${file}`));
  }

  if (config.dependencies.length) {
    const { install } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'install',
        message: 'Install required dependencies?',
        default: true,
      },
    ]);
    if (install) installDependencies(config.dependencies);
  }
}

// Interactive setup
async function initConfig() {
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'linter',
      message: 'Which linter/formatter to configure?',
      choices: ['ESLint', 'Prettier', 'Both'],
    },
    {
      type: 'list',
      name: 'projectType',
      message: 'What type of project?',
      choices: ['JavaScript', 'TypeScript', 'React'],
      when: ({ linter }) => linter === 'ESLint' || linter === 'Both',
    },
  ]);

  if (answers.linter === 'ESLint' || answers.linter === 'Both') {
    await generateConfig('eslint', { type: answers.projectType.toLowerCase() });
  }
  if (answers.linter === 'Prettier' || answers.linter === 'Both') {
    await generateConfig('prettier', {});
  }
}

// Save custom template
async function saveTemplate(name) {
  const templateFiles = ['.eslintrc.json', '.prettierrc', '.eslintignore', '.prettierignore'];
  const template = {};

  for (const file of templateFiles) {
    try {
      const content = await fs.readFile(path.join(process.cwd(), file), 'utf8');
      template[file] = content;
    } catch {
      // Skip if file doesn't exist
    }
  }

  const templates = await fs.readJson(TEMPLATES_DIR).catch(() => ({}));
  templates[name] = template;
  await fs.writeJson(TEMPLATES_DIR, templates, { spaces: 2 });
  console.log(chalk.green(`Template "${name}" saved!`));
}

program
  .command('init')
  .description('Interactively set up linter configurations')
  .action(() => initConfig());

program
  .command('eslint')
  .description('Generate ESLint configuration')
  .option('--type <type>', 'Project type (js, typescript, react)', 'js')
  .action((options) => generateConfig('eslint', options));

program
  .command('prettier')
  .description('Generate Prettier configuration')
  .action(() => generateConfig('prettier', {}));

program
  .command('save <name>')
  .description('Save current linter configs as a custom template')
  .action((name) => saveTemplate(name));

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
  console.log(chalk.cyan('Use the "init" command to start configuring linters!'));
}
