#!/usr/bin/env python3
"""Score a Debrief JSON run for category-fit and invented stats."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

PM_SUITE = re.compile(
    r"\b(asana|trello|jira|monday\.com|monday|clickup|basecamp|smartsheet|wrike|ms project|microsoft project)\b",
    re.I,
)
GOOD_SUB = re.compile(
    r"\b(chatgpt|claude|openai|gemini|validatorai|idea.?validat|giga|perplexity|copy\.ai|jasper)\b",
    re.I,
)
FAKE_PCT = re.compile(
    r"\d+(?:\.\d+)?%\s+of\s+(?:g2|capterra|reddit|twitter|x\.com|reviews?)\b",
    re.I,
)
NAMED_COMMUNITY = re.compile(r"r/|reddit\.com|discord\.gg|product hunt", re.I)

PAYLOAD = {
    "title": "7 agents evaluate my project idea and tell me ship or kill",
    "description": (
        "han to Mera Idea Hai Ki Main Ek agent Banaunga jismein 7 agents Honge "
        "aur jismein pura Mera project ka idea aur detail Mein Dunga aur sath agents "
        "different role ke Honge to ek senior engineer ho gaya ek product manager ho "
        "gaya ek engineer Ho Gaya Ek jo investor invest Karta Hai VC to yah different "
        "different Karega aur uske bad idea dega should i ship it or not"
    ),
    "context": "Founder dictation. Product is an AI briefing room, not project management software.",
}


def load(path: Path) -> dict:
    return json.loads(path.read_text())


def names(research: dict) -> list[str]:
    return [c.get("name") or "" for c in (research.get("competitors") or [])]


def score(data: dict) -> dict:
    research = data.get("research") or {}
    comps = names(research)
    pm = []
    good = []
    for c in research.get("competitors") or []:
        blob = f"{c.get('name','')} {c.get('url','')} {c.get('description','')}"
        if PM_SUITE.search(blob):
            pm.append(c.get("name"))
        if GOOD_SUB.search(blob):
            good.append(c.get("name"))

    gaps_blob = json.dumps(research.get("gaps") or {})
    fake = FAKE_PCT.findall(gaps_blob)
    communities = (research.get("distribution") or {}).get("communities") or []
    named = sum(1 for x in communities if NAMED_COMMUNITY.search(json.dumps(x)))

    pos = research.get("positioning") or {}
    category = pos.get("category") or ""
    pm_category = bool(re.search(r"project management", category, re.I))

    synth = (data.get("synthesis") or {}).get("output") or ""
    verdict_m = re.search(r"<verdict>\s*(SHIP IT|PIVOT|KILL IT)\s*</verdict>", synth, re.I)
    scores = (data.get("synthesis") or {}).get("scores") or {}

    brief = research.get("brief") or {}

    # Higher is better. Penalize PM misfires and fake percents.
    quality = 10
    quality -= 3 * min(len(pm), 3)
    quality -= 2 * min(len(fake), 3)
    if pm_category:
        quality -= 2
    if not good:
        quality -= 2
    if named == 0 and communities:
        quality -= 1
    quality = max(0, min(10, quality))

    return {
        "quality": quality,
        "verdict": verdict_m.group(1).upper() if verdict_m else "UNKNOWN",
        "overall": scores.get("overall"),
        "competitor_names": comps,
        "pm_suite_hits": pm,
        "good_substitute_hits": good,
        "fake_percent_stats": fake,
        "positioning_category": category,
        "pm_category": pm_category,
        "communities": [c.get("name") for c in communities],
        "named_community_urls": named,
        "brief_title": brief.get("title"),
        "one_liner": pos.get("one_liner"),
        "error": data.get("error"),
    }


def main() -> None:
    if len(sys.argv) < 2:
        print("usage: score_run.py RUN.json", file=sys.stderr)
        sys.exit(2)
    path = Path(sys.argv[1])
    result = score(load(path))
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
