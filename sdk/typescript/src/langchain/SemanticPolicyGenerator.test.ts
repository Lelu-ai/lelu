import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  construct: vi.fn(),
}));
vi.mock('openai', () => ({
  OpenAI: class {
    chat = { completions: { create: mocks.create } };
    constructor(options: { apiKey: string }) { mocks.construct(options); }
  },
}));
import { SemanticPolicyGenerator } from './SemanticPolicyGenerator.js';

describe('SemanticPolicyGenerator', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('initializes OpenAI only on first generation and reuses its client', async () => {
    mocks.create.mockResolvedValue({ choices: [{ message: { content: '```rego\npackage demo\n```' } }] });
    const generator = new SemanticPolicyGenerator('test-key');
    expect(mocks.construct).not.toHaveBeenCalled();
    const results = await Promise.all([
      generator.generateRegoPolicy('Deny all', 'demo'),
      generator.generateRegoPolicy('Require review', 'demo'),
    ]);
    expect(results).toEqual(['package demo', 'package demo']);
    expect(mocks.construct).toHaveBeenCalledTimes(1);
    expect(mocks.construct).toHaveBeenCalledWith({ apiKey: 'test-key' });
    expect(mocks.create).toHaveBeenCalledTimes(2);
    expect(mocks.create.mock.calls[0]![0].messages[1].content).toContain('Deny all');
  });

  it('preserves API errors rather than reporting a missing peer', async () => {
    const error = new Error('API request rejected');
    mocks.create.mockRejectedValue(error);
    await expect(new SemanticPolicyGenerator('test-key').generateRegoPolicy('Deny all')).rejects.toBe(error);
  });
});
