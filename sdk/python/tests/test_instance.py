"""Tests for the Python SDK — LeluInstance.handler (ASGI 3 mountable app).

lelu() factory / default-actor authorize() behavior is already covered by
tests/test_local.py; this file focuses on the new ASGI handler.
"""

from __future__ import annotations

import json
from typing import Any

import pytest
from pytest_httpx import HTTPXMock

from lelu import LeluClient, LeluInstance


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


def http_scope(method: str, path: str) -> dict[str, Any]:
    return {"type": "http", "method": method, "path": path}


# ─── Fixtures ─────────────────────────────────────────────────────────────────


@pytest.fixture
def instance() -> LeluInstance:
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
        http_scope("POST", "/authorize"),
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
    await instance.handler(http_scope("GET", "/queue"), make_receive(), recorder)
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
        http_scope("POST", "/queue/rev-1/approve"),
        make_receive(json.dumps({"resolved_by": "alice"}).encode()),
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
    await instance.handler(http_scope("GET", "/nope"), make_receive(), recorder)
    assert recorder.status == 404


@pytest.mark.asyncio
async def test_handler_rejects_non_http_scope(instance: LeluInstance) -> None:
    with pytest.raises(RuntimeError):
        await instance.handler({"type": "websocket"}, make_receive(), Recorder())
