from __future__ import annotations

import os
import re
from dataclasses import dataclass
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel


router = APIRouter(tags=["recipes"])


def _data_dir() -> Path:
    env = os.environ.get("DATA_DIR")
    if env:
        return Path(env)

    # Docker compose mounts `./data` -> `/data`
    if Path("/data").exists():
        return Path("/data")

    # Local dev fallback: repo-root `./data`
    # `.../backend/app/routes/recipes.py` -> parents: routes/ (0), app/ (1), backend/ (2), repo root/ (3)
    repo_root = Path(__file__).resolve().parents[3]
    local = repo_root / "data"
    if local.exists():
        return local

    # Last resort: current working directory
    return Path.cwd() / "data"


def _recipes_dir() -> Path:
    return _data_dir() / "recipes"

def _ensure_dirs() -> None:
    _recipes_dir().mkdir(parents=True, exist_ok=True)


class RecipeListItem(BaseModel):
    slug: str
    title: str
    filename: str


class RecipeDetail(BaseModel):
    slug: str
    title: str
    filename: str
    markdown: str


@dataclass(frozen=True)
class _ParsedMd:
    title: str
    markdown: str


def _title_case(s: str) -> str:
    s = re.sub(r"\s+", " ", s.strip())
    if not s:
        return s
    # Simple title-case that preserves existing capitalization reasonably well.
    return " ".join(w[:1].upper() + w[1:] for w in s.split(" "))


def _clean_stem(stem: str) -> str:
    # Strip common scanned-image suffix like: "-IMG_7869" / "_IMG_7869"
    s = re.sub(r"([_-])IMG[_-]?\d+\s*$", "", stem, flags=re.IGNORECASE).strip()
    s = s.replace("_", " ").replace("-", " ")
    s = re.sub(r"\s+", " ", s).strip()
    return _title_case(s)


def _parse_title_from_md(md: str) -> str | None:
    # Very small YAML-frontmatter parser for "title: ..."
    if not md.startswith("---\n"):
        return None
    end = md.find("\n---", 4)
    if end == -1:
        return None
    fm = md[4:end].splitlines()
    for line in fm:
        m = re.match(r'^\s*title:\s*"(.*)"\s*$', line)
        if m:
            return m.group(1).strip()
        m2 = re.match(r"^\s*title:\s*(.+?)\s*$", line)
        if m2:
            return m2.group(1).strip().strip('"')
    return None


def _parse_h1_title_from_md(md: str) -> str | None:
    # Prefer the first top-level markdown heading: "# Title"
    # (ignore leading blank lines / BOM)
    s = md.replace("\r\n", "\n").lstrip("\ufeff")
    for line in s.splitlines():
        if not line.strip():
            continue
        m = re.match(r"^\s*#\s+(.+?)\s*$", line)
        if m:
            return m.group(1).strip()
        # First non-empty line wasn't an H1 -> stop looking.
        break
    return None


def _read_recipe(path: Path) -> _ParsedMd:
    md = path.read_text(encoding="utf-8")
    title = _parse_title_from_md(md) or _parse_h1_title_from_md(md) or _clean_stem(path.stem)
    title = _title_case(title)
    return _ParsedMd(title=title, markdown=md)


@router.get("/recipes", response_model=list[RecipeListItem])
def list_recipes() -> list[RecipeListItem]:
    _ensure_dirs()
    items: list[RecipeListItem] = []
    for p in sorted(_recipes_dir().glob("*.md")):
        parsed = _read_recipe(p)
        items.append(RecipeListItem(slug=p.stem, title=parsed.title, filename=p.name))
    return items


@router.get("/recipes/{slug}", response_model=RecipeDetail)
def get_recipe(slug: str) -> RecipeDetail:
    _ensure_dirs()
    path = _recipes_dir() / f"{slug}.md"
    if not path.exists():
        raise HTTPException(status_code=404, detail="recipe not found")
    parsed = _read_recipe(path)
    return RecipeDetail(slug=slug, title=parsed.title, filename=path.name, markdown=parsed.markdown)


