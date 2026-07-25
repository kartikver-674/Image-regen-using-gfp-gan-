"""In-process job store + a size-1 threadpool runner. No external queue."""
from __future__ import annotations

import traceback
import uuid
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeoutError
from threading import Lock

from restore_engine import config


class JobStore:
    def __init__(self):
        self._jobs: dict[str, dict] = {}
        self._lock = Lock()

    def create(self) -> str:
        jid = uuid.uuid4().hex
        with self._lock:
            self._jobs[jid] = {"status": "queued", "result": None, "error": None}
        return jid

    def get(self, jid: str) -> dict | None:
        with self._lock:
            rec = self._jobs.get(jid)
            return dict(rec) if rec else None

    def _set(self, jid, **kw):
        with self._lock:
            if jid in self._jobs:
                self._jobs[jid].update(kw)

    def set_running(self, jid): self._set(jid, status="running")
    def set_done(self, jid, result): self._set(jid, status="done", result=result)
    def set_error(self, jid, error): self._set(jid, status="error", error=error)


class JobRunner:
    def __init__(self, service, store: JobStore, max_workers: int = 1):
        self._service = service
        self._store = store
        self._pool = ThreadPoolExecutor(max_workers=max_workers)

    def submit(self, jid, input_path, options, output_dir):
        self._pool.submit(self._run, jid, input_path, options, output_dir)

    def _run(self, jid, input_path, options, output_dir):
        self._store.set_running(jid)
        # ponytail: nested 1-thread pool just to get a timeout on a blocking call.
        # On timeout the underlying thread isn't killed (Python can't do that) and
        # keeps running in the background; acceptable for a local single-user job
        # runner. Upgrade to a process pool (killable) if that leak matters.
        worker = ThreadPoolExecutor(max_workers=1)
        try:
            fut = worker.submit(self._service.run, input_path, options, output_dir)
            result = fut.result(timeout=config.JOB_TIMEOUT_S)
            self._store.set_done(jid, result)
        except FutureTimeoutError:
            self._store.set_error(jid, f"job timed out after {config.JOB_TIMEOUT_S}s")
        except Exception as exc:  # noqa: BLE001 - surface any failure as job error
            self._store.set_error(jid, f"{exc}\n{traceback.format_exc()}")
        finally:
            worker.shutdown(wait=False)

    def shutdown(self, wait: bool = True):
        self._pool.shutdown(wait=wait)
