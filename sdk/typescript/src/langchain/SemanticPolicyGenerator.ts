import { OpenAI } from 'openai';

export class SemanticPolicyGenerator {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Converts a natural language description into a deterministic Rego policy.
   * 
   * @param description Natural language description of the policy (e.g., "Don't let the bot refund more than $50 unless approved by a finance manager.")
   * @param packageName The Rego package name (default: "lelu.authz")
   * @returns The generated Rego policy string
   */
  async generateRegoPolicy(description: string, packageName: string = "lelu.authz"): Promise<string> {
    const prompt = `
You are an expert in Open Policy Agent (OPA) Rego policies.
Your task is to convert the following natural language description into a valid, deterministic Rego policy for the Lelu Auth Permission Engine.

The policy must output an object with the following structure:
{
  "allowed": bool,
  "reason": string,
  "downgraded_scope": string (optional),
  "requires_human_review": bool (optional)
}

The input to the policy will be an object with the following structure:
{
  "kind": "agent" | "human",
  "actor": string,
  "action": string,
  "resource": map[string]any,
  "confidence": number (0.0 to 1.0),
  "acting_for": string,
  "scope": string
}

Natural Language Description:
"${description}"

Package Name:
package ${packageName}

Requirements:
1. Output ONLY valid Rego code.
2. Do not include markdown formatting (like \`\`\`rego).
3. Ensure the default state is deny (default allowed = false).
4. Include comments explaining the logic.
`;

    const response = await this.openai.chat.completions.create({
      // gpt-4-turbo-preview was shut down on 2026-03-26: https://developers.openai.com/api/docs/deprecations
      model: "gpt-4.1",
      messages: [
        { role: "system", content: "You are a Rego policy generation assistant. Output only raw Rego code." },
        { role: "user", content: prompt }
      ],
      temperature: 0.1,
    });

    const regoCode = response.choices[0]?.message.content?.trim() || "";
    
    // Strip markdown code blocks if the LLM accidentally included them
    return regoCode.replace(/^```rego\n/, '').replace(/\n```$/, '');
  }
}
