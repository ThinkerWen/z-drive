from __future__ import annotations

import asyncio
from contextlib import suppress

import schedule
from fastapi import FastAPI

from app.core.config import Settings
from app.core.logging import logger
from app.db.session import SessionLocal
from app.services.cloud_share import DriveShareService
from app.services.gallery import GalleryService

CORN_TAG = "z-drive-corn"


def _cleanup_expired_shares_job() -> None:
    db = SessionLocal()
    try:
        cleaned_count = DriveShareService.cleanup_expired_shares(db)
        if cleaned_count > 0:
            logger.info("cleaned {} expired cloud shares", cleaned_count)
    except Exception:  # noqa: BLE001
        logger.exception("failed to clean expired cloud shares")
    finally:
        db.close()


def _sync_gallery_preview_job(settings: Settings) -> None:
    db = SessionLocal()
    try:
        stats = GalleryService(settings).sync_gallery_previews(db)
        if stats["created"] > 0 or stats["removed"] > 0 or stats["updated"] > 0:
            logger.info(
                "gallery preview sync done: created={}, removed={}, updated={}",
                stats["created"],
                stats["removed"],
                stats["updated"],
            )
    except Exception:  # noqa: BLE001
        logger.exception("failed to sync gallery previews")
    finally:
        db.close()


def _register_corn_jobs(settings: Settings) -> None:
    schedule.clear(CORN_TAG)
    schedule.every(1).minutes.do(_cleanup_expired_shares_job).tag(CORN_TAG)
    schedule.every(1).minutes.do(_sync_gallery_preview_job, settings=settings).tag(CORN_TAG)


async def _corn_loop(stop_event: asyncio.Event) -> None:
    while not stop_event.is_set():
        schedule.run_pending()
        try:
            await asyncio.wait_for(stop_event.wait(), timeout=1)
        except asyncio.TimeoutError:
            continue


def start_corn(app: FastAPI, settings: Settings) -> None:
    _register_corn_jobs(settings)

    # Run once on startup so existing stale data can be fixed immediately.
    _cleanup_expired_shares_job()
    _sync_gallery_preview_job(settings)

    stop_event = asyncio.Event()
    corn_task = asyncio.create_task(_corn_loop(stop_event))

    app.state.corn_stop_event = stop_event
    app.state.corn_task = corn_task


async def stop_corn(app: FastAPI) -> None:
    stop_event = getattr(app.state, "corn_stop_event", None)
    corn_task = getattr(app.state, "corn_task", None)

    if stop_event is not None:
        stop_event.set()

    if corn_task is not None:
        corn_task.cancel()
        with suppress(asyncio.CancelledError):
            await corn_task

    schedule.clear(CORN_TAG)
