"""Zero-config local engine discovery.

``npx lelu-mcp start`` runs a local engine on a random port and records it in
``~/.lelu/engine.json`` (next to the per-install ``~/.lelu/engine.key``
secret). When the client is constructed with no ``base_url``, no ``api_key``,
and no env override, those files are read so ``LeluClient()`` / ``lelu()``
just work against the engine already running on this machine — no account,
no configuration.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path

__all__ = ["LocalEngineInfo", "discover_local_engine"]


@dataclass(frozen=True)
class LocalEngineInfo:
    base_url: str | None = None
    api_key: str | None = None


def discover_local_engine() -> LocalEngineInfo:
    """Discovers a locally running Lelu engine started by ``lelu-mcp``.

    Returns empty info when no engine is recorded or when the recorded
    engine process is no longer alive.
    """
    home = Path(os.environ.get("LELU_HOME") or Path.home() / ".lelu")

    try:
        runtime = json.loads((home / "engine.json").read_text("utf-8"))
    except (OSError, ValueError):
        return LocalEngineInfo()

    url = runtime.get("url") if isinstance(runtime, dict) else None
    pid = runtime.get("pid") if isinstance(runtime, dict) else None
    if not isinstance(url, str) or not url or not isinstance(pid, int):
        return LocalEngineInfo()

    # The runtime file survives hard crashes — trust it only if the engine
    # process is still alive (signal 0 = existence check, sends nothing).
    try:
        os.kill(pid, 0)
    except OSError:
        return LocalEngineInfo()

    api_key: str | None = None
    try:
        key = (home / "engine.key").read_text("utf-8").strip()
        api_key = key or None
    except OSError:
        pass  # engine may run keyless (LELU_DEV_INSECURE)

    return LocalEngineInfo(base_url=url, api_key=api_key)
