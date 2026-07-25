import time

from restore_api.jobs import JobRunner, JobStore
from restore_engine import config


class FakeService:
    def __init__(self):
        self.calls = []

    def run(self, input_path, options, output_dir):
        self.calls.append((input_path, options, output_dir))
        return {"ok": True, "input": str(input_path)}


def test_jobstore_lifecycle():
    s = JobStore()
    jid = s.create()
    assert s.get(jid)["status"] == "queued"
    s.set_running(jid)
    assert s.get(jid)["status"] == "running"
    s.set_done(jid, {"restored_url": "/x"})
    rec = s.get(jid)
    assert rec["status"] == "done" and rec["result"]["restored_url"] == "/x"


def test_jobstore_error():
    s = JobStore()
    jid = s.create()
    s.set_error(jid, "boom")
    assert s.get(jid)["status"] == "error" and s.get(jid)["error"] == "boom"


def test_runner_executes_and_marks_done(tmp_path):
    store = JobStore()
    svc = FakeService()
    runner = JobRunner(svc, store, max_workers=1)
    jid = store.create()
    runner.submit(jid, tmp_path / "in.png", {"mode": "auto"}, tmp_path / "out")
    runner.shutdown(wait=True)
    assert svc.calls and store.get(jid)["status"] == "done"


def test_runner_marks_error_on_timeout(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "JOB_TIMEOUT_S", 0.05)

    class Slow:
        def run(self, *a, **k):
            time.sleep(0.3)
            return {"ok": True}

    store = JobStore()
    runner = JobRunner(Slow(), store, max_workers=1)
    jid = store.create()
    runner.submit(jid, tmp_path / "in.png", {}, tmp_path / "out")
    runner.shutdown(wait=False)  # don't block the test on the leaked slow call
    time.sleep(0.15)
    rec = store.get(jid)
    assert rec["status"] == "error" and "timed out" in rec["error"]


def test_runner_marks_error_on_exception(tmp_path):
    class Boom:
        def run(self, *a, **k):
            raise RuntimeError("nope")

    store = JobStore()
    runner = JobRunner(Boom(), store, max_workers=1)
    jid = store.create()
    runner.submit(jid, tmp_path / "in.png", {}, tmp_path / "out")
    runner.shutdown(wait=True)
    assert store.get(jid)["status"] == "error" and "nope" in store.get(jid)["error"]
