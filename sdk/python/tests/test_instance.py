"""Tests for the Python SDK — LeluInstance.handler (ASGI 3 mountable app).

lelu() factory / default-actor authorize() behavior is already covered by
tests/test_local.py; this file focuses on the new ASGI handler.
"""

from __future__ import annotations

import json
from typing import Any

import pytest
from pytest_httpx import HTTPXMock

from lelu import HandlerCaller, LeluClient, LeluInstance


# ─── ASGI test helpers ────────────────────────────────────────────────────────


def make_receive(body: bytes = b""):
    sent = False

    async def receive() -> dict[str, Any]:
        nonlocal sent
        if sent:
            return {"type": "http.disconnect"}
        sent = True
        return {"type": "http.request", "body": body, "more_body": False}

    return receive


class Recorder:
    def __init__(self) -> None:
        self.messages: list[dict[str, Any]] = []

    async def __call__(self, message: dict[str, Any]) -> None:
        self.messages.append(message)

    @property
    def status(self) -> int:
        return int(self.messages[0]["status"])

    @property
    def json(self) -> Any:
        body = b"".join(m.get("body", b"") for m in self.messages if m["type"] == "http.response.body")
        return json.loads(body) if body else None


def http_scope(method: str, path: str, user: str | None = None) -> dict[str, Any]:
    return {"type": "http", "method": method, "path": path, "user": user}


# ─── Fixtures ─────────────────────────────────────────────────────────────────


def _authenticate(scope: dict[str, Any]) -> HandlerCaller | None:
    """A stand-in for the app's own auth: scope['user'] is 'alice' (a reviewer),
    'bob' (may only authorize) or absent."""
    user = scope.get("user")
    if user == "alice":
        return HandlerCaller(reviewer="alice")
    if user == "bob":
        return HandlerCaller()
    return None


@pytest.fixture
def instance() -> LeluInstance:
    """An instance whose handler is guarded by the app's authentication."""
    return LeluInstance(
        LeluClient(base_url="http://localhost:8080"),
        actor="billing-agent",
        authenticate=_authenticate,
        reviewer_key="reviewer-secret-0123456789",
    )


@pytest.fixture
def unguarded() -> LeluInstance:
    """No `authenticate`: the handler must refuse everything but /ok."""
    return LeluInstance(LeluClient(base_url="http://localhost:8080"), actor="billing-agent")


# ─── ASGI handler ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_handler_authorize(instance: LeluInstance, httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(
        method="POST",
        url="http://localhost:8080/v1/agent/authorize",
        json={"allowed": True, "reason": "ok", "trace_id": "t1", "requires_human_review": False},
    )
    recorder = Recorder()
    await instance.handler(
        http_scope("POST", "/authorize", user="bob"),
        make_receive(json.dumps({"tool": "refund:process"}).encode()),
        recorder,
    )
    assert recorder.status == 200
    assert recorder.json["allowed"] is True


@pytest.mark.asyncio
async def test_handler_queue_list(instance: LeluInstance, httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(
        method="GET",
        url="http://localhost:8080/v1/queue/pending",
        json={"items": [], "count": 0},
    )
    recorder = Recorder()
    await instance.handler(http_scope("GET", "/queue", user="alice"), make_receive(), recorder)
    assert recorder.status == 200
    assert recorder.json == {"items": [], "count": 0}


@pytest.mark.asyncio
async def test_handler_queue_approve(instance: LeluInstance, httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(
        method="POST",
        url="http://localhost:8080/v1/queue/rev-1/approve",
        json={"success": True},
    )
    recorder = Recorder()
    await instance.handler(
        http_scope("POST", "/queue/rev-1/approve", user="alice"),
        make_receive(json.dumps({"note": "ok"}).encode()),
        recorder,
    )
    assert recorder.status == 200
    assert recorder.json == {"success": True}


@pytest.mark.asyncio
async def test_handler_ok(instance: LeluInstance, httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(method="GET", url="http://localhost:8080/healthz", json={"status": "ok"})
    recorder = Recorder()
    await instance.handler(http_scope("GET", "/ok"), make_receive(), recorder)
    assert recorder.status == 200
    assert recorder.json == {"ok": True}


@pytest.mark.asyncio
async def test_handler_unknown_route_404(instance: LeluInstance) -> None:
    recorder = Recorder()
    await instance.handler(http_scope("GET", "/nope", user="bob"), make_receive(), recorder)
    assert recorder.status == 404
    # Unauthenticated callers learn nothing about which routes exist.
    anon = Recorder()
    await instance.handler(http_scope("GET", "/nope"), make_receive(), anon)
    assert anon.status == 401


@pytest.mark.asyncio
async def test_handler_rejects_non_http_scope(instance: LeluInstance) -> None:
    with pytest.raises(RuntimeError):
        await instance.handler({"type": "websocket"}, make_receive(), Recorder())


# ─── Handler authentication (the Python twin of TypeScript's `authenticate`) ──


@pytest.mark.asyncio
async def test_unguarded_handler_serves_only_ok(unguarded: LeluInstance, httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(method="GET", url="http://localhost:8080/healthz", json={"status": "ok"})
    ok = Recorder()
    await unguarded.handler(http_scope("GET", "/ok"), make_receive(), ok)
    assert ok.status == 200

    for method, path, body in [
        ("POST", "/authorize", {"tool": "refund:process"}),
        ("GET", "/queue", {}),
        ("POST", "/queue/rev-1/approve", {"resolved_by": "mallory"}),
        ("POST", "/queue/rev-1/deny", {}),
    ]:
        rec = Recorder()
        await unguarded.handler(http_scope(method, path, user="alice"), make_receive(json.dumps(body).encode()), rec)
        assert rec.status == 403, (method, path)
        assert rec.json["error"] == "handler_not_configured"
    # Nothing but /ok reached the engine.
    assert [str(r.url) for r in httpx_mock.get_requests()] == ["http://localhost:8080/healthz"]


@pytest.mark.asyncio
async def test_unauthenticated_caller_gets_401(instance: LeluInstance, httpx_mock: HTTPXMock) -> None:
    for method, path in [("POST", "/authorize"), ("GET", "/queue"), ("POST", "/queue/rev-1/approve")]:
        rec = Recorder()
        await instance.handler(http_scope(method, path), make_receive(b"{}"), rec)
        assert rec.status == 401, (method, path)
    assert httpx_mock.get_requests() == []


@pytest.mark.asyncio
async def test_non_reviewer_may_authorize_but_not_use_the_queue(
    instance: LeluInstance, httpx_mock: HTTPXMock
) -> None:
    httpx_mock.add_response(
        method="POST",
        url="http://localhost:8080/v1/agent/authorize",
        json={"allowed": True, "reason": "ok", "trace_id": "t1", "requires_human_review": False},
    )
    ok = Recorder()
    await instance.handler(
        http_scope("POST", "/authorize", user="bob"), make_receive(json.dumps({"tool": "x"}).encode()), ok
    )
    assert ok.status == 200

    for method, path in [("GET", "/queue"), ("POST", "/queue/rev-1/approve"), ("POST", "/queue/rev-1/deny")]:
        rec = Recorder()
        await instance.handler(http_scope(method, path, user="bob"), make_receive(b"{}"), rec)
        assert rec.status == 403, (method, path)
    # Only the authorize call reached the engine.
    assert len(httpx_mock.get_requests()) == 1


@pytest.mark.asyncio
async def test_approval_records_the_authenticated_reviewer_not_the_body(
    instance: LeluInstance, httpx_mock: HTTPXMock
) -> None:
    httpx_mock.add_response(
        method="POST", url="http://localhost:8080/v1/queue/rev-1/approve", json={"success": True}
    )
    rec = Recorder()
    await instance.handler(
        http_scope("POST", "/queue/rev-1/approve", user="alice"),
        make_receive(json.dumps({"resolved_by": "mallory", "note": "looks fine"}).encode()),
        rec,
    )
    assert rec.status == 200 and rec.json == {"success": True}

    sent = httpx_mock.get_requests()[0]
    assert json.loads(sent.content) == {"resolved_by": "alice", "note": "looks fine"}
    assert sent.headers["X-Lelu-Reviewer-Key"] == "reviewer-secret-0123456789"


@pytest.mark.asyncio
async def test_authenticate_may_be_async(httpx_mock: HTTPXMock) -> None:
    async def authenticate(scope: dict[str, Any]) -> HandlerCaller | None:
        return HandlerCaller(reviewer="carol") if scope.get("user") == "carol" else None

    inst = LeluInstance(LeluClient(base_url="http://localhost:8080"), authenticate=authenticate)
    httpx_mock.add_response(method="GET", url="http://localhost:8080/v1/queue/pending", json={"items": [], "total": 0})
    ok = Recorder()
    await inst.handler(http_scope("GET", "/queue", user="carol"), make_receive(), ok)
    assert ok.status == 200
    denied = Recorder()
    await inst.handler(http_scope("GET", "/queue", user="dave"), make_receive(), denied)
    assert denied.status == 401


# ─── Reviewer key on the client (L-16) ────────────────────────────────────────


@pytest.mark.asyncio
async def test_approve_and_deny_send_the_reviewer_key(httpx_mock: HTTPXMock) -> None:
    client = LeluClient(base_url="http://localhost:8080")
    httpx_mock.add_response(method="POST", url="http://localhost:8080/v1/queue/rev-1/approve", json={"success": True})
    httpx_mock.add_response(method="POST", url="http://localhost:8080/v1/queue/rev-2/deny", json={"success": True})
    assert await client.approve_review("rev-1", "alice", "ok", reviewer_key="secret-0123456789abcd") is True
    assert await client.deny_review("rev-2", "alice", "no", reviewer_key="secret-0123456789abcd") is True
    for request in httpx_mock.get_requests():
        assert request.headers["X-Lelu-Reviewer-Key"] == "secret-0123456789abcd"


@pytest.mark.asyncio
async def test_approve_without_a_reviewer_key_sends_no_header(httpx_mock: HTTPXMock) -> None:
    client = LeluClient(base_url="http://localhost:8080")
    httpx_mock.add_response(method="POST", url="http://localhost:8080/v1/queue/rev-1/approve", json={"success": True})
    await client.approve_review("rev-1", "alice")
    assert "x-lelu-reviewer-key" not in httpx_mock.get_requests()[0].headers
