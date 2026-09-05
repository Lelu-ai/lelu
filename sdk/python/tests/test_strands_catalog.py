"""Checks the Strands catalog submission stays valid.

`docs/integrations/strands-catalog-submission.yaml` is the entry submitted to
strands-agents/harness-sdk to list Lelu at strandsagents.com/integrations. It
lives outside any package and is never imported, so nothing else would notice
if it drifted — a renamed package or a description grown past their limit would
only surface as a rejected pull request, or worse, a catalog entry pointing at
something that no longer exists.

The assertions mirror the published requirements of the Get Featured guide, and
the two that matter most tie the declared package names back to what this repo
actually builds.
"""

from __future__ import annotations

import datetime as dt
import json
import re
import tomllib
from pathlib import Path

import pytest

yaml = pytest.importorskip("yaml", reason="PyYAML is required to validate the catalog entry")

REPO_ROOT = Path(__file__).resolve().parents[3]
CATALOG = REPO_ROOT / "docs" / "integrations" / "strands-catalog-submission.yaml"

# The nine values the Get Featured guide permits.
VALID_TYPES = {
    "tool",
    "model-provider",
    "session-manager",
    "memory-store",
    "storage",
    "integration",
    "plugin",
    "agent-extension",
    "intervention",
}

pytestmark = pytest.mark.skipif(
    not CATALOG.exists(),
    reason="catalog entry not present (running outside a source checkout)",
)


@pytest.fixture(scope="module")
def entry() -> dict:
    return yaml.safe_load(CATALOG.read_text())


def test_required_fields_are_present(entry: dict) -> None:
    for field in ("name", "description", "integrationType", "languages", "github", "addedDate"):
        assert field in entry, f"{field} is required by the Get Featured guide"


def test_description_is_one_sentence_within_the_limit(entry: dict) -> None:
    """Their guide asks for a single sentence of roughly 160 characters."""
    description = entry["description"]
    assert len(description) <= 160, f"description is {len(description)} chars, limit is ~160"
    assert description.endswith("."), "description should be a complete sentence"
    assert description.count(".") == 1, "description should be a single sentence"


def test_integration_type_is_one_they_accept(entry: dict) -> None:
    assert entry["integrationType"] in VALID_TYPES


def test_does_not_claim_fields_the_strands_team_assigns(entry: dict) -> None:
    """featured and badges are theirs to set. Sending them is a reason to bounce
    the submission, and it would be presumptuous besides."""
    assert "featured" not in entry
    assert "badges" not in entry


def test_python_package_name_matches_what_this_repo_publishes(entry: dict) -> None:
    """Catches a rename: the catalog would otherwise point at a package that
    no longer exists on PyPI."""
    pyproject = tomllib.loads((REPO_ROOT / "sdk" / "python" / "pyproject.toml").read_text())
    assert entry["languages"]["python"]["package"] == pyproject["project"]["name"]


def test_typescript_package_name_matches_what_this_repo_publishes(entry: dict) -> None:
    package_json = json.loads((REPO_ROOT / "sdk" / "typescript" / "package.json").read_text())
    assert entry["languages"]["typescript"]["package"] == package_json["name"]


def test_both_languages_are_declared(entry: dict) -> None:
    """The integration ships for both, so the catalog should say so — a missing
    language is an audience that never finds it."""
    assert set(entry["languages"]) == {"python", "typescript"}


def test_links_are_https(entry: dict) -> None:
    assert entry["github"].startswith("https://github.com/")
    if "docsUrl" in entry:
        assert entry["docsUrl"].startswith("https://")


def test_added_date_is_a_real_iso_date(entry: dict) -> None:
    raw = entry["addedDate"]
    # PyYAML parses an unquoted YYYY-MM-DD into a date; either form is fine as
    # long as it is a real calendar date in the format they ask for.
    if isinstance(raw, dt.date):
        return
    assert re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(raw)), "addedDate must be YYYY-MM-DD"
    dt.date.fromisoformat(str(raw))
