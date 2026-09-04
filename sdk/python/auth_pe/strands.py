"""Lelu authorization for Strands Agents.

Strands' intervention system asks a handler what to do before each tool call,
and the actions it accepts line up with Lelu's decisions almost exactly. That
makes this a mapping rather than a translation:

    Lelu decision   Strands action   Effect
    ─────────────   ──────────────   ──────────────────────────────────────
    allow           Proceed          the tool runs as the model intended
    deny            Deny             cancelled; the model is told why
    compute         Transform        re-pointed at the policy's safe tool
    human_review    Confirm          paused for a human via the interrupt

Usage
-----
.. code-block:: python

    from strands import Agent
    from lelu import LeluClient
    from lelu.strands import LeluIntervention

    agent = Agent(
        tools=[refund, lookup_invoice],
        interventions=[LeluIntervention(LeluClient(...), actor="invoice_bot")],
    )

Strands evaluates handlers in registration order and suggests putting cheap
authorization checks first, so this belongs at the front of the list.
"""

from __future__ import annotations

import logging
from typing import Any, Callable, Literal

from .client import LeluClient
from .models import AgentContext, AuthorizeRequest

logger = logging.getLogger(__name__)

__all__ = [
    "LeluIntervention",
    "ToolCall",
    "GuardOutcome",
    "decide",
    "extract_call",
]

# ─── Strands imports ─────────────────────────────────────────────────────────
#
# Optional on purpose. The decision logic below is useful and testable without
# Strands installed, and a hard import would make this module unimportable for
# anyone who has Lelu but not Strands. The handler class itself needs the real
# base class, so constructing one without Strands raises with an explanation.

try:  # pragma: no cover - depends on the environment, not the logic
    from strands.interventions import (
        Confirm,
        Deny,
        InterventionHandler,
        Proceed,
        Transform,
    )

    _STRANDS_AVAILABLE = True
except ImportError:  # pragma: no cover
    Confirm = Deny = Proceed = Transform = None  # type: ignore[assignment]
    InterventionHandler = object  # type: ignore[assignment,misc]
    _STRANDS_AVAILABLE = False


# ─── Framework-independent core ──────────────────────────────────────────────


class ToolCall:
    """The parts of a tool invocation Lelu evaluates.

    Lifted out of the Strands event so the decision logic can be tested without
    constructing framework objects, and so an API change is confined to
    extract_call rather than reaching into policy handling.
    """

    def __init__(self, name: str, arguments: dict[str, Any] | None = None, tool_use_id: str = "") -> None:
        self.name = name
        self.arguments = arguments or {}
        self.tool_use_id = tool_use_id


class GuardOutcome:
    """What the guard decided about a tool call, before it becomes an action.

    ``action`` is one of ``"allow"``, ``"deny"``, ``"redirect"`` or
    ``"review"``.
    """

    def __init__(
        self,
        action: Literal["allow", "deny", "redirect", "review"],
        message: str = "",
        reason: str = "",
        trace_id: str = "",
        review_id: str = "",
        replacement_tool: str | None = None,
        replacement_args: dict[str, Any] | None = None,
        decision: Any = None,
        request: AuthorizeRequest | None = None,
    ) -> None:
        self.action = action
        self.message = message
        self.reason = reason
        self.trace_id = trace_id
        self.review_id = review_id
        self.replacement_tool = replacement_tool
        self.replacement_args = replacement_args
        # Kept so redemption can replay the exact decision and request. The
        # engine binds an approval to the payload it was granted for, so a
        # rebuilt request would be refused for no visible reason.
        self.decision = decision
        self.request = request

    @property
    def allowed(self) -> bool:
        return self.action == "allow"


def decide(
    decision: Any,
    call: ToolCall,
    actor: str,
    request: AuthorizeRequest | None = None,
) -> GuardOutcome:
    """Turn a Lelu decision into a guard outcome.

    Pure and synchronous: no network, no framework. This is the mapping, and
    the part worth testing.
    """
    trace_id = getattr(decision, "trace_id", "") or getattr(decision, "request_id", "")
    reason = getattr(decision, "reason", "") or ""

    if getattr(decision, "requires_human_review", False):
        return GuardOutcome(
            action="review",
            message=f"[Lelu] '{call.name}' requires human approval. Reason: {reason}",
            reason=reason,
            trace_id=trace_id,
            review_id=getattr(decision, "review_id", "") or "",
            decision=decision,
            request=request,
        )

    # Checked before `allowed`, because the engine reports a compute decision
    # as not-allowed for the tool that was actually requested. Reading
    # `allowed` first would turn every redirect into a denial.
    safe_tool = getattr(decision, "safe_tool", None)
    if safe_tool:
        return GuardOutcome(
            action="redirect",
            message=f"[Lelu] '{call.name}' redirected to '{safe_tool}'. Reason: {reason}",
            reason=reason,
            trace_id=trace_id,
            replacement_tool=safe_tool,
            replacement_args=getattr(decision, "safe_args", None),
            decision=decision,
            request=request,
        )

    if not getattr(decision, "allowed", False):
        msg = f"[Lelu] '{call.name}' was denied for agent '{actor}'. Reason: {reason}"
        if getattr(decision, "downgraded_scope", None):
            msg += f" Downgraded scope: {decision.downgraded_scope}."
        return GuardOutcome(
            action="deny", message=msg, reason=reason, trace_id=trace_id,
            decision=decision, request=request,
        )

    return GuardOutcome(
        action="allow", reason=reason, trace_id=trace_id,
        decision=decision, request=request,
    )


def extract_call(event: Any) -> ToolCall:
    """Lift the fields Lelu needs out of a Strands event.

    Reads ``tool_use`` as either a mapping or an object, so a change in how
    Strands models it does not reach past this function.
    """
    tool_use = getattr(event, "tool_use", None) or {}

    def field(*names: str, default: Any = "") -> Any:
        for name in names:
            if isinstance(tool_use, dict):
                if name in tool_use:
                    return tool_use[name]
                continue
            value = getattr(tool_use, name, None)
            if value is not None:
                return value
        return default

    args = field("input", "arguments", default={})
    return ToolCall(
        name=str(field("name", default="")),
        arguments=args if isinstance(args, dict) else {},
        tool_use_id=str(field("toolUseId", "tool_use_id", default="")),
    )


# ─── The intervention handler ────────────────────────────────────────────────


class LeluIntervention(InterventionHandler):  # type: ignore[misc]
    """Authorizes every Strands tool call through Lelu before it executes.

    Parameters
    ----------
    client:
        A configured :class:`LeluClient`.
    actor:
        The agent identity Lelu evaluates policy against — the name registered
        in your ``auth.yaml``.
    action_for:
        Maps a tool name to the permission string checked in policy. Defaults
        to the tool name unchanged; pass a callable if your policy uses a
        different vocabulary.
    confidence_for:
        Returns the model's confidence for this call (0.0–1.0). Omit it and the
        engine applies its configured MissingSignalMode rather than assuming a
        value — Lelu does not treat a caller-supplied number as verified.
    acting_for:
        User the agent is acting on behalf of, when there is one.
    on_review:
        What a ``human_review`` decision does. ``"confirm"`` (default) returns
        Strands' Confirm action, pausing the agent through its interrupt system
        so a human can approve in the flow the application already has.
        ``"deny"`` cancels instead, leaving Lelu's own review queue as the
        authority — use that when approval happens out of band and you intend
        to resume with :meth:`redeem`.
    on_error:
        Strands' own error policy for this handler. Defaults to ``"deny"``,
        which is fail-closed. Strands' default is ``"throw"``; overridden here
        because a broken authorization check must not surface as an unhandled
        error rather than a blocked call.
    fail_open:
        If the engine is unreachable: ``False`` (default) denies the call,
        ``True`` allows it. Default closed — an authorization engine that
        permits everything when it breaks is not an authorization engine.
    """

    def __init__(
        self,
        client: LeluClient,
        actor: str,
        *,
        action_for: Callable[[ToolCall], str] | None = None,
        confidence_for: Callable[[ToolCall], float | None] | None = None,
        acting_for: str | None = None,
        on_review: Literal["confirm", "deny"] = "confirm",
        on_error: str = "deny",
        fail_open: bool = False,
    ) -> None:
        if not _STRANDS_AVAILABLE:
            raise ImportError(
                "strands-agents is not installed. Install it with: pip install strands-agents"
            )
        super().__init__()
        self.client = client
        self.actor = actor
        self.action_for = action_for or (lambda call: call.name)
        self.confidence_for = confidence_for or (lambda call: None)
        self.acting_for = acting_for
        self.on_review = on_review
        self._on_error = on_error
        self.fail_open = fail_open

    @property
    def name(self) -> str:
        return "lelu-authorization"

    @property
    def on_error(self) -> Any:
        return self._on_error

    # ── The intervention itself ──────────────────────────────────────────────

    async def before_tool_call(self, event: Any, **_: Any) -> Any:
        """Authorize the pending tool call and return the matching action."""
        call = extract_call(event)
        outcome = await self.evaluate(call)
        return self.to_action(event, outcome)

    async def evaluate(self, call: ToolCall) -> GuardOutcome:
        """Ask Lelu about one tool call.

        Separated from the intervention so it can be called directly, and
        tested without a Strands event.
        """
        # authorize(), not agent_authorize(): the client shares one body
        # builder between authorize() and redeem_review() precisely so an
        # approval granted here can be redeemed later against an identical
        # fingerprint. Building the request once and keeping it is the point.
        request = AuthorizeRequest(
            tool=self.action_for(call),
            actor=self.actor,
            args=call.arguments or None,
            context=AgentContext(
                confidence=self.confidence_for(call),
                acting_for=self.acting_for,
            ),
        )
        try:
            decision = await self.client.authorize(request)
        except Exception as exc:  # noqa: BLE001
            logger.error("lelu: authorization failed for tool=%s: %s", call.name, exc)
            if self.fail_open:
                logger.warning(
                    "lelu: failing open for tool=%s — the call was NOT authorized", call.name
                )
                return GuardOutcome(action="allow", reason=f"engine unreachable: {exc}")
            return GuardOutcome(
                action="deny",
                message=f"[Lelu] '{call.name}' blocked: authorization engine unreachable ({exc}).",
                reason=str(exc),
            )

        outcome = decide(decision, call, self.actor, request)
        logger.debug(
            "lelu: tool=%s action=%s trace_id=%s", call.name, outcome.action, outcome.trace_id
        )
        return outcome

    def to_action(self, event: Any, outcome: GuardOutcome) -> Any:
        """Translate an outcome into the Strands action that expresses it.

        Separated from before_tool_call so the mapping can be tested without
        standing up an agent.
        """
        if outcome.action == "allow":
            return Proceed(reason=outcome.reason or None)

        if outcome.action == "redirect":
            if outcome.replacement_tool:
                tool = outcome.replacement_tool
                args = outcome.replacement_args

                def apply(_event: Any, _tool: str = tool, _args: Any = args) -> None:
                    tool_use = getattr(_event, "tool_use", None)
                    if isinstance(tool_use, dict):
                        tool_use["name"] = _tool
                        if _args is not None:
                            tool_use["input"] = _args
                    elif tool_use is not None:
                        tool_use.name = _tool
                        if _args is not None:
                            tool_use.input = _args

                return Transform(apply=apply, reason=outcome.message)
            # A redirect we cannot express must stop the call, not fall through
            # to running the tool that was never authorized.
            return Deny(reason=outcome.message)

        if outcome.action == "review":
            if self.on_review == "confirm":
                return Confirm(prompt=outcome.message, reason=outcome.reason or None)
            return Deny(reason=outcome.message)

        return Deny(reason=outcome.message)

    # ── Resuming a paused call ───────────────────────────────────────────────

    async def redeem(self, outcome: GuardOutcome, timeout_ms: int = 30_000) -> Any:
        """Wait for a human decision on a paused call, then redeem it.

        Pass the :class:`GuardOutcome` from :meth:`evaluate` — it carries both
        the decision and the exact request that was paused. Redemption
        re-checks that payload against what the reviewer actually approved, so
        an approval cannot be spent on a call they never saw, and it is
        single-use.

        Relevant when ``on_review="deny"`` and approval happens in Lelu's own
        queue rather than through Strands' interrupt.
        """
        if outcome.request is None or outcome.decision is None:
            raise ValueError(
                "this outcome carries no request to redeem — only a review outcome can be redeemed"
            )
        return await self.client.wait_and_redeem(
            outcome.decision, outcome.request, timeout_ms=timeout_ms
        )
