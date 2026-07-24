"""Custom Terminal-Bench agent: real ClaudeCodeAgent with the Lelu plugin
installed (shadow mode) before the task instruction runs.

Reuses terminal_bench's actual ClaudeCodeAgent entirely — same install of
the real @anthropic-ai/claude-code package, same invocation
(`claude --verbose --output-format stream-json -p ...`) — and overrides
only the container setup script. AbstractInstalledAgent resolves that
template next to wherever the concrete agent class's own file lives
(`inspect.getfile(self.__class__)`), so placing claude-code-setup.sh.j2 in
this directory is enough; no method override is needed.

Run with:
  tb run --agent-import-path lelu_claude_code_agent:LeluClaudeCodeAgent ...
(with this directory on PYTHONPATH so the import resolves).
"""

from terminal_bench.agents.installed_agents.claude_code.claude_code_agent import (
    ClaudeCodeAgent,
)


class LeluClaudeCodeAgent(ClaudeCodeAgent):
    @staticmethod
    def name() -> str:
        return "lelu-claude-code"
