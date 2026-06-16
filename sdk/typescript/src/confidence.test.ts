import { describe, it, expect } from "vitest";
import { LeluClient } from "../src/index.js";

const { confidenceFrom } = LeluClient;

describe("LeluClient.confidenceFrom", () => {
  describe("openai()", () => {
    it("derives a score from logprobs", () => {
      const score = confidenceFrom.openai({
        choices: [{ logprobs: { content: [{ logprob: -0.02 }, { logprob: -0.05 }] } }],
      });
      expect(score).not.toBeNull();
      expect(score!).toBeGreaterThan(0.9);
      expect(score!).toBeLessThanOrEqual(1);
    });

    it("returns null when logprobs are absent (never fabricates)", () => {
      expect(confidenceFrom.openai({ choices: [{}] })).toBeNull();
      expect(confidenceFrom.openai({})).toBeNull();
    });
  });

  describe("anthropic()", () => {
    it("always returns null (no token logprobs)", () => {
      expect(confidenceFrom.anthropic({ anything: true })).toBeNull();
    });
  });

  describe("bedrock()", () => {
    it("derives a score from Cohere token_likelihoods", () => {
      const score = confidenceFrom.bedrock({
        generations: [{ token_likelihoods: [{ likelihood: -0.02 }, { likelihood: -0.05 }] }],
      });
      expect(score).not.toBeNull();
      expect(score!).toBeGreaterThan(0.9);
      expect(score!).toBeLessThanOrEqual(1);
    });

    it("derives a score from a passed-through logprobs array", () => {
      const score = confidenceFrom.bedrock({ logprobs: [-0.1, -0.2, -0.05] });
      expect(score).not.toBeNull();
      expect(score!).toBeGreaterThan(0.8);
    });

    it("returns null for Claude on Bedrock (no token signal)", () => {
      expect(confidenceFrom.bedrock({})).toBeNull();
      expect(confidenceFrom.bedrock({ generations: [{ token_likelihoods: null }] })).toBeNull();
    });
  });
});
