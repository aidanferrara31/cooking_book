from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes.recipes import router as recipes_router


def _data_dir() -> str:
    env = os.environ.get("DATA_DIR")
    if env:
        return env

    # Docker compose mounts `./data` -> `/data`
    if os.path.exists("/data"):
        return "/data"

    # Local dev fallback: repo-root `./data`
    # `.../backend/app/main.py` -> parents: app/ (0), backend/ (1), repo root/ (2)
    here = os.path.abspath(__file__)
    repo_root = os.path.dirname(os.path.dirname(os.path.dirname(here)))
    local = os.path.join(repo_root, "data")
    if os.path.exists(local):
        return local

    # Last resort: current working directory
    return os.path.join(os.getcwd(), "data")


app = FastAPI(title="Cooking Book Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    data_dir = _data_dir()
    return {
        "ok": True,
        "data_dir": data_dir,
        "recipes_dir": os.path.join(data_dir, "recipes"),
        "images_dir": os.path.join(data_dir, "images"),
    }


app.include_router(recipes_router, prefix="/api")


