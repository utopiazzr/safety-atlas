"""Local SQLite state for one batch; never retries or stores sample contents."""

import json
import hashlib
import math
import re
import sqlite3
import os
from contextlib import ExitStack, closing, contextmanager
from pathlib import Path


APPLICATION_ID = 0x53434642
SCHEMA_VERSION = 2


@contextmanager
def writer_lock(path: str | Path):
    """Cooperating writers hold an OS lock; a stale lock file is harmless."""
    lock_path = Path(str(Path(path).expanduser().resolve()) + ".writer.lock")
    if lock_path.is_symlink():
        raise ValueError("invalid_batch_lock")
    with lock_path.open("a+b") as stream:
        if stream.seek(0, os.SEEK_END) == 0:
            stream.write(b"0")
            stream.flush()
        stream.seek(0)
        try:
            if os.name == "nt":
                import msvcrt
                msvcrt.locking(stream.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(stream.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError as exc:
            raise ValueError("batch_writer_lock_unavailable") from exc
        try:
            yield
        finally:
            stream.seek(0)
            if os.name == "nt":
                msvcrt.locking(stream.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(stream.fileno(), fcntl.LOCK_UN)


def create_ledger(path: Path, *, manifest_sha256: str, snapshots: list[tuple],
                  model: str, provider_sha256: str, metric_version: str) -> sqlite3.Connection:
    # Reserve the file without overwriting an existing ledger.
    with path.open("xb"):
        pass
    db = sqlite3.connect(str(path))
    try:
        db.execute("PRAGMA synchronous = FULL")
        db.execute(f"PRAGMA application_id = {APPLICATION_ID}")
        db.execute(f"PRAGMA user_version = {SCHEMA_VERSION}")
        db.execute("CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
        db.execute("CREATE TABLE items (id TEXT PRIMARY KEY, sample_sha256 TEXT NOT NULL, "
                   "state TEXT NOT NULL CHECK(state IN ('pending','in_flight','completed')), result_json TEXT)")
        db.executemany("INSERT INTO meta(key,value) VALUES(?,?)", [("manifest_sha256", manifest_sha256),
                       ("model", model), ("provider_sha256", provider_sha256),
                       ("metric_version", metric_version)])
        db.executemany("INSERT INTO items(id,sample_sha256,state) VALUES(?,?,'pending')",
                       [(item_id, hashlib.sha256(raw).hexdigest()) for item_id, raw, _ in snapshots])
        db.commit()
    except Exception:
        db.close()
        raise
    return db


def mark_in_flight(db: sqlite3.Connection, item_id: str) -> None:
    cursor = db.execute("UPDATE items SET state='in_flight' WHERE id=? AND state='pending'", (item_id,))
    if cursor.rowcount != 1:
        raise ValueError("invalid_ledger_transition")
    db.commit()


def mark_completed(db: sqlite3.Connection, item_id: str, report: dict) -> None:
    encoded = json.dumps(report, ensure_ascii=True, separators=(",", ":"))
    cursor = db.execute("UPDATE items SET state='completed', result_json=? WHERE id=? AND state='in_flight'",
                        (encoded, item_id))
    if cursor.rowcount != 1:
        raise ValueError("invalid_ledger_transition")
    db.commit()


def _read_ledger(path: str | Path) -> tuple[dict, list[tuple[str, str, str, dict | None]]]:
    from .faithfulness import FaithfulnessReport

    uri = Path(path).expanduser().resolve(strict=True).as_uri() + "?mode=ro"
    with closing(sqlite3.connect(uri, uri=True)) as db:
        schema_version = db.execute("PRAGMA user_version").fetchone()[0]
        if (db.execute("PRAGMA application_id").fetchone()[0] != APPLICATION_ID
                or schema_version not in (1, SCHEMA_VERSION)):
            raise ValueError("invalid_faithfulness_ledger")
        meta = dict(db.execute("SELECT key,value FROM meta"))
        expected = {"manifest_sha256", "model", "provider_sha256"}
        if schema_version == SCHEMA_VERSION:
            expected.add("metric_version")
        if (set(meta) != expected
                or not isinstance(meta["model"], str) or not meta["model"].strip()
                or (schema_version == SCHEMA_VERSION and
                    (not isinstance(meta["metric_version"], str) or not meta["metric_version"].strip()))
                or not all(isinstance(meta[key], str) and re.fullmatch(r"[0-9a-f]{64}", meta[key])
                           for key in ("manifest_sha256", "provider_sha256"))):
            raise ValueError("invalid_faithfulness_ledger")
        rows = []
        for item_id, sample_hash, state, raw_report in db.execute(
                "SELECT id,sample_sha256,state,result_json FROM items ORDER BY rowid"):
            if (not isinstance(item_id, str) or not item_id.strip() or len(item_id) > 256
                    or not isinstance(sample_hash, str) or not re.fullmatch(r"[0-9a-f]{64}", sample_hash)):
                raise ValueError("invalid_faithfulness_ledger")
            if state == "completed":
                if raw_report is None:
                    raise ValueError("invalid_faithfulness_ledger")
                report = FaithfulnessReport.model_validate_json(raw_report).model_dump()
                if (report["sample_sha256"] != sample_hash or report["judge_model"] != meta["model"]
                        or report["provider_sha256"] != meta["provider_sha256"]
                        or (schema_version == SCHEMA_VERSION and report["metric_version"] != meta["metric_version"])):
                    raise ValueError("invalid_faithfulness_ledger")
            elif state in {"pending", "in_flight"} and raw_report is None:
                report = None
            else:
                raise ValueError("invalid_faithfulness_ledger")
            rows.append((item_id, sample_hash, state, report))
    meta["schema_version"] = schema_version
    return meta, rows


def open_ledger_writer(path: str | Path) -> sqlite3.Connection:
    uri = Path(path).expanduser().resolve(strict=True).as_uri() + "?mode=rw"
    db = sqlite3.connect(uri, uri=True)
    db.execute("PRAGMA synchronous = FULL")
    return db


def inspect_ledger(path: str | Path) -> dict:
    meta, rows = _read_ledger(path)
    states = {"pending": 0, "in_flight": 0, "completed": 0}
    items = []
    for item_id, sample_hash, state, report in rows:
        states[state] += 1
        items.append({"id": item_id, "sample_sha256": sample_hash, "state": state,
                      "result_status": report["status"] if report else None,
                      "score": report["score"] if report else None})
    return {"manifest_sha256": meta["manifest_sha256"], "state_counts": states, "items": items,
            "scope": "local_record_only_in_flight_outcome_unknown_no_automatic_retry"}


def export_ledger(path: str | Path, output_path: str | Path) -> dict:
    _, rows = _read_ledger(path)
    completed = [(item_id, report) for item_id, _, state, report in rows if state == "completed"]
    with Path(output_path).expanduser().open("x", encoding="utf-8", newline="\n") as output:
        for item_id, report in completed:
            output.write(json.dumps({"id": item_id, "result": report}, ensure_ascii=True) + "\n")
    return {"exported_count": len(completed), "output_path": str(Path(output_path).expanduser().resolve()),
            "scope": "recorded_completed_items_only"}


def compare_ledgers(baseline_path: str | Path, candidate_path: str | Path) -> dict:
    """Compare matching scored cases while both cooperating writers are idle."""
    baseline_path = Path(baseline_path).expanduser().resolve(strict=True)
    candidate_path = Path(candidate_path).expanduser().resolve(strict=True)
    if baseline_path.samefile(candidate_path):
        raise ValueError("same_batch_ledger")
    with ExitStack() as stack:
        for path in sorted((baseline_path, candidate_path), key=lambda p: os.path.normcase(str(p))):
            stack.enter_context(writer_lock(path))
        baseline_meta, baseline_rows = _read_ledger(baseline_path)
        candidate_meta, candidate_rows = _read_ledger(candidate_path)
    if baseline_meta["schema_version"] != 2 or candidate_meta["schema_version"] != 2:
        raise ValueError("legacy_ledger_not_comparable")
    for field in ("model", "provider_sha256", "metric_version"):
        if baseline_meta[field] != candidate_meta[field]:
            raise ValueError("incomparable_batch_" + field)
    before = {item_id: (state, report) for item_id, _, state, report in baseline_rows}
    after = {item_id: (state, report) for item_id, _, state, report in candidate_rows}
    if not before or set(before) != set(after):
        raise ValueError("incomparable_batch_ids")
    counts = {"increased": 0, "decreased": 0, "unchanged": 0, "incompatible": 0, "unknown": 0}
    changes, deltas = [], []
    for item_id in sorted(before):
        before_state, before_report = before[item_id]
        after_state, after_report = after[item_id]
        first_status = before_report["status"] if before_report else before_state
        second_status = after_report["status"] if after_report else after_state
        delta = None
        if before_report and after_report and any(before_report[field] != after_report[field]
                                                    for field in ("question_sha256", "contexts_sha256")):
            comparison = "incompatible"
        elif first_status != "scored" or second_status != "scored":
            comparison = "unknown"
        else:
            delta = after_report["score"] - before_report["score"]
            comparison = "increased" if delta > 0 else "decreased" if delta < 0 else "unchanged"
            deltas.append(delta)
        counts[comparison] += 1
        changes.append({"id": item_id, "baseline_status": first_status, "candidate_status": second_status,
                        "score_delta": delta, "comparison": comparison})
    return {"baseline_manifest_sha256": baseline_meta["manifest_sha256"],
            "candidate_manifest_sha256": candidate_meta["manifest_sha256"],
            "case_count": len(before), "comparable_scored_count": len(deltas),
            "comparison_counts": counts, "mean_score_delta": math.fsum(deltas) / len(deltas) if deltas else None,
            "cases": changes, "scope": "paired_recorded_model_scores_not_proof_of_truth_or_repair"}
