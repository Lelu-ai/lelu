"""Tests for zero-config local engine discovery and the lelu() factory."""

from __future__ import annotations

import json
import os
from pathlib import Path

import pytest
from pytest_httpx import HTTPXMock

from lelu import AuthorizeRequest, LeluClient, discover_local_engine, lelu


@pytest.fixture
def lelu_home(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    monkeypatch.setenv("LELU_HOME", str(tmp_path))
    monkeypatch.delenv("LELU_BASE_URL", raising=False)
    monkeypatch.delenv("LELU_API_KEY", raising=False)
    return tmp_path


def _write_runtime(home: Path, url: str = "http://127.0.0.1:53421", pid: int | None = None) -> None:
    (home / "engine.json").write_text(json.dumps({"url": url, "pid": pid or os.getpid()}))


# ─── discover_local_engine ────────────────────────────────────────────────────


def test_discovers_live_engine_with_key(lelu_home: Path) -> None:
    _write_runtime(lelu_home)
    (lelu_home / "engine.key").write_text("lelu_local_abc123\n")

    info = discover_local_engine()
    assert info.base_url == "http://127.0.0.1:53421"
    assert info.api_key == "lelu_local_abc123"


def test_discovers_engine_without_key(lelu_home: Path) -> None:
    _write_runtime(lelu_home)

    info = discover_local_engine()
    assert info.base_url == "http://127.0.0.1:53421"
    assert info.api_key is None


def test_ignores_dead_engine_record(lelu_home: Path) -> None:
    _write_runtime(lelu_home, pid=2**30)  # practically never allocated

    assert discover_local_engine().base_url is None


def test_empty_when_no_runtime_file(lelu_home: Path) -> None:
    assert discover_local_engine().base_url is None


def test_empty_for_corrupt_runtime_file(lelu_home: Path) -> None:
    (lelu_home / "engine.json").write_text("not-json{")
    assert discover_local_engine().base_url is None


# ─── LeluClient zero-config resolution ────────────────────────────────────────


def test_client_uses_discovered_engine(lelu_home: Path) -> None:
    _write_runtime(lelu_home)
    (lelu_home / "engine.key").write_text("lelu_local_abc123\n")

    client = LeluClient()
    assert str(client._client.base_url) == "http://127.0.0.1:53421"
    assert client._client.headers["Authorization"] == "Bearer lelu_local_abc123"


def test_explicit_base_url_wins_over_discovery(lelu_home: Path) -> None:
    _write_runtime(lelu_home)
    (lelu_home / "engine.key").write_text("lelu_local_abc123\n")

    client = LeluClient(base_url="http://engine.example.com")
    assert str(client._client.base_url) == "http://engine.example.com"
    assert "Authorization" not in client._client.headers


def test_api_key_still_targets_cloud(lelu_home: Path) -> None:
    _write_runtime(lelu_home)

    client = LeluClient(api_key="lelu_sk_x_y")
    assert str(client._client.base_url) == "https://lelu-ai.com"


def test_default_url_without_engine(lelu_home: Path) -> None:
    client = LeluClient()
    assert str(client._client.base_url) == "http://localhost:8080"


# ─── lelu() factory ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_factory_applies_default_actor(lelu_home: Path, httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(
        json={
            "allowed": True,
            "requires_human_review": False,
            "compute": False,
            "reason": "ok",
            "trace_id": "t1",
            "confidence_used": 0,
        }
    )
    async with lelu(base_url="http://localhost:8080", actor="billing-agent") as auth:
        result = await auth.authorize(tool="refund:process")

    assert result.decision == "allow"
    sent = json.loads(httpx_mock.get_requests()[0].content)
    assert sent["actor"] == "billing-agent"


@pytest.mark.asyncio
async def test_factory_explicit_actor_wins(lelu_home: Path, httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(
        json={
            "allowed": True,
            "requires_human_review": False,
            "compute": False,
            "reason": "ok",
            "trace_id": "t1",
            "confidence_used": 0,
        }
    )
    async with lelu(base_url="http://localhost:8080", actor="billing-agent") as auth:
        await auth.authorize(AuthorizeRequest(tool="refund:process", actor="support-agent"))

    sent = json.loads(httpx_mock.get_requests()[0].content)
    assert sent["actor"] == "support-agent"


@pytest.mark.asyncio
async def test_factory_rejects_request_plus_kwargs(lelu_home: Path) -> None:
    async with lelu(base_url="http://localhost:8080") as auth:
        with pytest.raises(TypeError):
            await auth.authorize(AuthorizeRequest(tool="x"), tool="y")
