"""Lelu integration for Strands Agents.

Strands fires ``BeforeToolCallEvent`` after a tool has been resolved but
before it runs, and lets a hook cancel the call, swap in a different tool, or
rewrite the arguments. Those are the same three outcomes Lelu already returns,
so this integration is a mapping rather than a translation:

    Lelu decision   Strands action
    ─────────────   ──────────────────────────────────────────────
    allow           return; the tool runs as the model intended
    deny            cancel the call, with the policy's reason
    compute         re-point the call at the engine's safe_tool
    human_review    cancel and surface the review id (see below)

Usage
-----
.. code-block:: python

    from strands import Agent
    from lelu import LeluClient
    from lelu.strands import LeluHook

    guard = LeluHook(LeluClient(base_url="http://localhost:8080"), actor="invoice_bot")
    agent = Agent(tools=[refund, lookup], hooks=[guard])

Every tool call the agent makes is now authorized before it executes, and the
decision is written to Lelu's audit log whether it was allowed or not.

On human review
---------------
``human_review`` means a person has to decide, which is not something a
synchronous hook can wait for without blocking the agent indefinitely. The
default is to cancel the call and return the review id, so the caller can
resume deliberately once a human has acted — see :meth:`LeluHook.redeem`.

If your Strands version supports interrupts, pass ``on_review="interrupt"`` to
raise instead, so the framework's own pause/resume machinery handles it.
"""

from __future__ import annotations

import asyncio
import logging
import threading
from typing import Any, Callable, Literal

from .client import LeluClient
from .models import AgentContext, AuthorizeRequest

logger = logging.getLogger(__name__)

__all__ = [
    "LeluHook",
    "PermissionDeniedError",
    "HumanReviewRequired",
    "ToolCall",
    "GuardOutcome",
    "decide",
]

# ─── Strands import, optional ────────────────────────────────────────────────
#
# Kept optional on purpose: the decision logic below is useful and testable
# without Strands installed, and a hard import would make this module
# unimportable for anyone who has Lelu but not Strands.

try:  # pragma: no cover - exercised only when Strands is installed
    from strands.hooks import BeforeToolCallEvent  # type: ignore[import-not-found]

    _STRANDS_AVAILABLE = True
except ImportError:  # pragma: no cover
    BeforeToolCallEvent = None  # type: ignore[assignment,misc]
    _STRANDS_AVAILABLE = False


# ─── Errors ──────────────────────────────────────────────────────────────────


class PermissionDeniedError(Exception):
    """Raised when Lelu denies a tool call and ``raise_on_deny`` is set."""

    def __init__(self, message: str, reason: str, trace_id: str = "") -> None:
        super().__init__(message)
        self.reason = reason
        self.trace_id = trace_id


class HumanReviewRequired(Exception):
    """Raised when a tool call needs a human decision.

    Carries ``review_id`` so the caller can poll, wait, or redeem the approval
    once a reviewer has acted, rather than losing the pending item.
    """

    def __init__(self, message: str, reason: str, review_id: str = "", trace_id: str = "") -> None:
        super().__init__(message)
        self.reason = reason
        self.review_id = review_id
        self.trace_id = trace_id


# ─── Framework-independent core ──────────────────────────────────────────────


class ToolCall:
    """The parts of a tool invocation Lelu needs, lifted out of Strands.

    Exists so the decision logic can be tested without constructing framework
    objects, and so a Strands API change is confined to the adapter below
    rather than reaching into policy handling.
    """

    def __init__(self, name: str, arguments: dict[str, Any] | None = None, tool_use_id: str = "") -> None:
        self.name = name
        self.arguments = arguments or {}
        self.tool_use_id = tool_use_id


class GuardOutcome:
    """What the hook decided to do about a tool call.

    ``action`` is one of ``"allow"``, ``"deny"``, ``"redirect"`` or
    ``"review"``. ``replacement_tool`` and ``replacement_args`` are set only
    for ``"redirect"``.
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
        # Kept so redemption can reuse the exact decision and request rather
        # than rebuilding them. The engine fingerprints the request body to
        # bind an approval to a payload, so a rebuilt body that differs even
        # slightly would fail redemption for no visible reason.
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
    """Turn a Lelu decision into a Strands outcome.

    Pure and synchronous: no network, no framework. This is where the mapping
    lives, and it is the part worth testing.
    """
    trace_id = getattr(decision, "trace_id", "") or getattr(decision, "request_id", "")
    reason = getattr(decision, "reason", "") or ""

    if getattr(decision, "requires_human_review", False):
        return GuardOutcome(
            action="review",
            message=(
                f"[Lelu] '{call.name}' requires human review before it can run. "
                f"Reason: {reason}"
            ),
            reason=reason,
            trace_id=trace_id,
            review_id=getattr(decision, "review_id", "") or "",
            decision=decision,
            request=request,
        )

    # A compute decision is an allow with a substitution: the engine is saying
    # "not that, but this is fine". Checked before `allowed`, because the
    # engine reports it as not-allowed for the tool that was asked for.
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


def _run_sync(coro: Any) -> Any:
    """Run a coroutine from a context that may or may not already have a loop.

    Strands calls hooks synchronously, but an agent is frequently driven from
    async code. ``asyncio.run`` raises inside a running loop, so fall back to a
    dedicated thread with its own loop rather than failing the tool call.
    """
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(coro)

    result: dict[str, Any] = {}

    def _worker() -> None:
        try:
            result["value"] = asyncio.run(coro)
        except BaseException as exc:  # noqa: BLE001 - re-raised on the caller's thread
            result["error"] = exc

    thread = threading.Thread(target=_worker, daemon=True)
    thread.start()
    thread.join()
    if "error" in result:
        raise result["error"]
    return result.get("value")


# ─── Strands hook provider ───────────────────────────────────────────────────


class LeluHook:
    """Authorizes every Strands tool call through Lelu before it executes.

    Register it on an agent and every tool call is checked:

    .. code-block:: python

        agent = Agent(tools=[...], hooks=[LeluHook(client, actor="invoice_bot")])

    Parameters
    ----------
    client:
        A configured :class:`LeluClient`.
    actor:
        The agent identity Lelu evaluates policy against — the name registered
        in your ``auth.yaml``.
    action_for:
        Maps a tool name to the permission string checked in policy. Defaults
        to using the tool name unchanged, which is usually what you want; pass
        a callable if your policy uses a different vocabulary.
    confidence_for:
        Optional callable returning the model's confidence for this call
        (0.0–1.0). Omit it and the engine applies its configured
        MissingSignalMode rather than assuming a value. Lelu does not treat a
        caller-supplied number as verified — see the engine's
        ``provider_signal_present``.
    acting_for:
        User the agent is acting on behalf of, when there is one.
    tenant_id:
        Tenant identity for multi-tenant engines.
    raise_on_deny:
        Raise :class:`PermissionDeniedError` instead of cancelling the call.
        Cancelling is the default because it lets the model read the reason and
        choose something else, which is usually more useful than a traceback.
    on_review:
        ``"cancel"`` (default) surfaces the review id and stops the call.
        ``"interrupt"`` raises :class:`HumanReviewRequired` so a Strands
        interrupt handler can pause and resume around it.
    fail_open:
        If the engine is unreachable: ``False`` (default) cancels the call,
        ``True`` allows it. Default closed — an authorization engine that
        allows everything when it breaks is not an authorization engine. Set
        this to ``True`` only with your eyes open.
    """

    def __init__(
        self,
        client: LeluClient,
        actor: str,
        *,
        action_for: Callable[[ToolCall], str] | None = None,
        confidence_for: Callable[[ToolCall], float | None] | None = None,
        acting_for: str | None = None,
        tenant_id: str | None = None,
        raise_on_deny: bool = False,
        on_review: Literal["cancel", "interrupt"] = "cancel",
        fail_open: bool = False,
    ) -> None:
        self.client = client
        self.actor = actor
        self.action_for = action_for or (lambda call: call.name)
        self.confidence_for = confidence_for or (lambda call: None)
        self.acting_for = acting_for
        self.tenant_id = tenant_id
        self.raise_on_deny = raise_on_deny
        self.on_review = on_review
        self.fail_open = fail_open

    # ── Strands HookProvider protocol ────────────────────────────────────────

    def register_hooks(self, registry: Any, **_: Any) -> None:
        """Subscribe to BeforeToolCallEvent. Called by Strands on registration."""
        if not _STRANDS_AVAILABLE:
            raise ImportError(
                "strands-agents is not installed. Install it with: pip install strands-agents"
            )
        registry.add_callback(BeforeToolCallEvent, self.before_tool_call)

    # ── The hook itself ──────────────────────────────────────────────────────

    def before_tool_call(self, event: Any) -> None:
        """Authorize the pending tool call and apply the decision to ``event``."""
        call = _extract_call(event)
        outcome = self.evaluate(call)
        _apply(event, outcome)

        if outcome.action == "deny" and self.raise_on_deny:
            raise PermissionDeniedError(outcome.message, outcome.reason, outcome.trace_id)
        if outcome.action == "review" and self.on_review == "interrupt":
            raise HumanReviewRequired(
                outcome.message, outcome.reason, outcome.review_id, outcome.trace_id
            )

    def evaluate(self, call: ToolCall) -> GuardOutcome:
        """Ask Lelu about one tool call. Separated from the hook so it can be
        called directly, and tested without a Strands event."""
        # authorize(), not agent_authorize(): authorize() and redeem_review()
        # share the same body builder in the client precisely so an approval
        # granted here can be redeemed later against an identical fingerprint.
        # Building the request once and keeping it is the whole point.
        request = AuthorizeRequest(
            tool=self.action_for(call),
            actor=self.actor,
            args=call.arguments or None,
            resource={"tool": call.name},
            tenant_id=self.tenant_id,
            context=AgentContext(
                confidence=self.confidence_for(call),
                acting_for=self.acting_for,
            ),
        )
        try:
            decision = _run_sync(self.client.authorize(request))
        except Exception as exc:  # noqa: BLE001
            logger.error("lelu: authorization failed for tool=%s: %s", call.name, exc)
            if self.fail_open:
                logger.warning("lelu: failing open for tool=%s — the call was NOT authorized", call.name)
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

    def redeem(self, outcome: GuardOutcome, timeout_ms: int = 30_000) -> Any:
        """Wait for a human decision on a paused call, then redeem it.

        Pass the :class:`GuardOutcome` returned by :meth:`evaluate` — it
        carries both the decision and the exact request that was paused.
        Redemption re-checks that payload against what the reviewer actually
        approved, so an approval cannot be spent on a call they never saw.

        Returns a ``RedeemResult``. ``allowed`` is false for every failure —
        timed out while pending, denied, or payload no longer matching — so
        there is one thing to check rather than three.
        """
        if outcome.request is None or outcome.decision is None:
            raise ValueError(
                "this outcome carries no request to redeem — only a review outcome can be redeemed"
            )
        return _run_sync(
            self.client.wait_and_redeem(
                outcome.decision, outcome.request, timeout_ms=timeout_ms
            )
        )


# ─── Adapter: Strands event <-> ToolCall/GuardOutcome ────────────────────────
#
# Confined to these two functions deliberately. Strands names some fields
# differently between its Python and TypeScript SDKs (tool_use / toolUse), and
# the hook API is still moving, so both spellings are accepted and a missing
# field degrades to a safe default rather than raising inside the agent loop.


def _extract_call(event: Any) -> ToolCall:
    tool_use = getattr(event, "tool_use", None) or getattr(event, "toolUse", None) or {}

    def _field(*names: str, default: Any = "") -> Any:
        for name in names:
            if isinstance(tool_use, dict) and name in tool_use:
                return tool_use[name]
            value = getattr(tool_use, name, None)
            if value is not None:
                return value
        return default

    return ToolCall(
        name=str(_field("name", default="")),
        arguments=_field("input", "arguments", default={}) or {},
        tool_use_id=str(_field("toolUseId", "tool_use_id", default="")),
    )


def _apply(event: Any, outcome: GuardOutcome) -> None:
    """Write the outcome back onto the Strands event."""
    if outcome.action == "allow":
        return

    if outcome.action == "redirect" and outcome.replacement_tool:
        # Renaming the tool makes Strands re-resolve it from the registry,
        # which is what we want: the safe tool is looked up by name rather
        # than smuggled in as an object this integration constructed.
        tool_use = getattr(event, "tool_use", None) or getattr(event, "toolUse", None)
        if isinstance(tool_use, dict):
            tool_use["name"] = outcome.replacement_tool
            if outcome.replacement_args is not None:
                tool_use["input"] = outcome.replacement_args
            return
        if tool_use is not None:
            setattr(tool_use, "name", outcome.replacement_tool)
            if outcome.replacement_args is not None:
                setattr(tool_use, "input", outcome.replacement_args)
            return
        # No usable tool_use — fall through and cancel rather than let an
        # unauthorized call proceed because the field was not where expected.

    # deny, review, or a redirect we could not apply: stop the call.
    for attr in ("cancel", "abort"):
        if hasattr(event, attr):
            setattr(event, attr, outcome.message or True)
            return
    logger.error(
        "lelu: could not cancel tool call — this Strands version exposes no cancel field. "
        "The call was NOT blocked. Please report this with your strands-agents version."
    )
