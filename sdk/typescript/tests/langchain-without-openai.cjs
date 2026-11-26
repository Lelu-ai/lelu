// Run after `npm run build:sdk`. Exercise the built public subpath without
// development dependencies, especially the optional OpenAI peer.
const assert = require('node:assert/strict');
const { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

const root = resolve(__dirname, '..');
const fixture = mkdtempSync(join(tmpdir(), 'lelu-optional-openai-'));
try {
  const modules = join(fixture, 'node_modules');
  const sdk = join(modules, 'lelu-agent-auth');
  mkdirSync(sdk, { recursive: true });
  cpSync(join(root, 'dist'), join(sdk, 'dist'), { recursive: true });
  cpSync(join(root, 'package.json'), join(sdk, 'package.json'));
  for (const dependency of Object.keys(require('../package.json').dependencies)) {
    const destination = join(modules, dependency);
    mkdirSync(require('node:path').dirname(destination), { recursive: true });
    symlinkSync(join(root, 'node_modules', dependency), destination, 'junction');
  }
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    const { SecureTool, SemanticPolicyGenerator } = await import('lelu-agent-auth/langchain');
    assert.equal(typeof SecureTool, 'function');
    const generator = new SemanticPolicyGenerator('not-a-real-key');
    await assert.rejects(generator.generateRegoPolicy('Deny all'), /npm install openai/);
  `], { cwd: fixture, encoding: 'utf8', env: { ...process.env, NODE_PATH: '' } });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  console.log('LangChain import and missing OpenAI diagnostic passed');
} finally {
  rmSync(fixture, { recursive: true, force: true });
}
