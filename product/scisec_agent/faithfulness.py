"""Evaluate normal answers against supplied context using the Ragas metric."""

import asyncio
import hashlib
import importlib.metadata
import json
import math
import os
from pathlib import Path

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator, model_validator

from .agenthop_runner import _completion_url


class EvidenceSample(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    question: str = Field(min_length=1)
    response: str = Field(min_length=1)
    contexts: list[str] = Field(min_length=1)

    @field_validator("question", "response")
    @classmethod
    def nonblank_text(cls, value):
        if not value.strip():
            raise ValueError("blank_text")
        try:
            value.encode("utf-8")
        except UnicodeEncodeError as exc:
            raise ValueError("invalid_unicode") from exc
        return value

    @field_validator("contexts")
    @classmethod
    def nonblank_contexts(cls, value):
        if any(not item.strip() for item in value):
            raise ValueError("blank_context")
        try:
            for item in value:
                item.encode("utf-8")
        except UnicodeEncodeError as exc:
            raise ValueError("invalid_unicode") from exc
        return value


class FaithfulnessReport(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    sample_sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    question_sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    contexts_sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    provider_sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    adapter_version: Literal["1"]
    metric: Literal["ragas_faithfulness"]
    metric_version: str = Field(min_length=1)
    judge_model: str = Field(min_length=1)
    score: float | None
    status: Literal["scored", "no_score", "judge_error", "unknown"]
    scope: Literal["context_support_model_judgment_not_truth_or_permission"]

    @model_validator(mode="after")
    def validate_score(self):
        if self.status == "scored":
            if self.score is None or not math.isfinite(self.score) or not 0 <= self.score <= 1:
                raise ValueError("invalid_score")
        elif self.score is not None:
            raise ValueError("score_without_scored_status")
        return self


class BatchItem(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    id: str = Field(min_length=1, max_length=256)
    sample: str = Field(min_length=1)


class BatchManifest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    schema_version: Literal["1"]
    samples: list[BatchItem] = Field(min_length=1)

    @model_validator(mode="after")
    def unique_ids(self):
        ids = [item.id for item in self.samples]
        if any(not item.strip() for item in ids) or len(ids) != len(set(ids)):
            raise ValueError("invalid_batch_ids")
        return self


def _read_sample(path: str | Path) -> tuple[bytes, EvidenceSample]:
    raw = Path(path).expanduser().read_bytes()
    try:
        return raw, EvidenceSample.model_validate_json(raw)
    except ValidationError as exc:
        raise ValueError("invalid_evidence_sample") from exc


def _sample_identity(sample: EvidenceSample) -> tuple[str, str]:
    question = hashlib.sha256(sample.question.encode("utf-8")).hexdigest()
    contexts = json.dumps(sample.contexts, ensure_ascii=True, separators=(",", ":")).encode("utf-8")
    return question, hashlib.sha256(contexts).hexdigest()

async def _score(sample: EvidenceSample, base_url: str, model: str, key: str, timeout: float):
    # CLI runs this in its own process before importing Ragas; do not send
    # Ragas usage telemetry as a side effect of evaluating the user's data.
    os.environ["RAGAS_DO_NOT_TRACK"] = "true"
    import httpx
    from openai import AsyncOpenAI
    from ragas.llms import llm_factory
    from ragas.metrics.collections import Faithfulness

    async with httpx.AsyncClient(timeout=timeout, follow_redirects=False, trust_env=False) as http:
        client = AsyncOpenAI(api_key=key, base_url=base_url.rstrip("/"), timeout=timeout,
                             max_retries=0, http_client=http)
        # Instructor's max_retries counts total attempts; 1 means no retries.
        judge = llm_factory(model, client=client, max_retries=1)
        result = await Faithfulness(llm=judge).ascore(user_input=sample.question,
                                                     response=sample.response,
                                                     retrieved_contexts=sample.contexts)
        return result.value


def _prepare_judge(base_url: str, model: str, api_key_env: str, timeout: float) -> str:
    if not model.strip() or not math.isfinite(timeout) or timeout <= 0:
        raise ValueError("invalid_model_or_timeout")
    _completion_url(base_url)
    key = os.environ.get(api_key_env)
    if not key:
        raise ValueError("provider_key_missing")
    return key


def _metric_version() -> str:
    try:
        return importlib.metadata.version("ragas")
    except importlib.metadata.PackageNotFoundError as exc:
        raise ValueError("install_faithfulness_extra") from exc


async def _evaluate_snapshot(raw: bytes, sample: EvidenceSample, *, base_url: str, model: str,
                             key: str, timeout: float, version: str) -> dict:
    question_hash, contexts_hash = _sample_identity(sample)
    report = {"sample_sha256": hashlib.sha256(raw).hexdigest(), "question_sha256": question_hash,
              "contexts_sha256": contexts_hash,
              "provider_sha256": hashlib.sha256(base_url.rstrip("/").encode("utf-8")).hexdigest(),
              "adapter_version": "1",
              "metric": "ragas_faithfulness", "metric_version": version,
              "judge_model": model, "score": None, "status": "unknown",
              "scope": "context_support_model_judgment_not_truth_or_permission"}
    try:
        value = await _score(sample, base_url, model, key, timeout)
        if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and 0 <= value <= 1:
            report["score"] = float(value)
            report["status"] = "scored"
        else:
            report["status"] = "no_score"
    except Exception:
        # Providers may echo secrets or user content in exception messages.
        report["status"] = "judge_error"
    return report


def evaluate_faithfulness(path: str | Path, *, base_url: str, model: str,
                          api_key_env: str = "LLM_API_KEY", timeout: float = 60) -> dict:
    """Send one explicit sample to a selected provider; output only a score."""
    key = _prepare_judge(base_url, model, api_key_env, timeout)
    raw, sample = _read_sample(path)
    version = _metric_version()
    return asyncio.run(_evaluate_snapshot(raw, sample, base_url=base_url, model=model,
                                          key=key, timeout=timeout, version=version))


def _run_batch(snapshots, output, db, *, base_url, model, key, timeout, version, concurrency):
    from .faithfulness_ledger import mark_completed, mark_in_flight
    scores = []
    counts = {"scored": 0, "no_score": 0, "judge_error": 0, "unknown": 0}

    async def run():
        queue = asyncio.Queue()
        for item in snapshots:
            queue.put_nowait(item)

        async def worker():
            while not queue.empty():
                item_id, raw, sample = queue.get_nowait()
                mark_in_flight(db, item_id)
                report = await _evaluate_snapshot(raw, sample, base_url=base_url, model=model,
                                                  key=key, timeout=timeout, version=version)
                mark_completed(db, item_id, report)
                output.write(json.dumps({"id": item_id, "result": report}, ensure_ascii=True) + "\n")
                output.flush()
                counts[report["status"]] += 1
                if report["score"] is not None:
                    scores.append(report["score"])
                queue.task_done()

        async with asyncio.TaskGroup() as group:
            for _ in range(min(concurrency, len(snapshots))):
                group.create_task(worker())

    try:
        asyncio.run(run())
    except ExceptionGroup as exc:
        raise ValueError("batch_execution_interrupted") from exc
    return {"requested_count": len(snapshots), "finished_count": sum(counts.values()),
            "status_counts": counts, "scored_count": len(scores),
            "scored_mean": sum(scores) / len(scores) if scores else None}


def _read_batch_manifest(manifest_path: str | Path):
    manifest_path = Path(manifest_path).expanduser().resolve(strict=True)
    manifest_raw = manifest_path.read_bytes()
    return manifest_path, manifest_raw, BatchManifest.model_validate_json(manifest_raw)


def _snapshot_item(manifest_path: Path, item: BatchItem):
    path = Path(item.sample).expanduser()
    if not path.is_absolute():
        path = manifest_path.parent / path
    raw, sample = _read_sample(path)
    return item.id, raw, sample


def _check_concurrency(concurrency):
    if type(concurrency) is not int or not 1 <= concurrency <= 64:
        raise ValueError("invalid_concurrency")


def evaluate_faithfulness_batch(manifest_path: str | Path, output_path: str | Path, *,
                                base_url: str, model: str, api_key_env: str = "LLM_API_KEY",
                                timeout: float = 60, concurrency: int = 4,
                                ledger_path: str | Path | None = None) -> dict:
    """Evaluate validated immutable sample snapshots, writing each result once."""
    from .faithfulness_ledger import create_ledger, writer_lock
    _check_concurrency(concurrency)
    key = _prepare_judge(base_url, model, api_key_env, timeout)
    manifest_path, manifest_raw, manifest = _read_batch_manifest(manifest_path)
    snapshots = [_snapshot_item(manifest_path, item) for item in manifest.samples]
    version = _metric_version()
    output_path = Path(output_path).expanduser().resolve()
    ledger_path = (Path(ledger_path).expanduser().resolve() if ledger_path is not None
                   else Path(str(output_path) + ".sqlite3"))
    if output_path == ledger_path:
        raise ValueError("batch_output_ledger_conflict")
    if output_path.exists() or ledger_path.exists():
        raise FileExistsError("batch_output_or_ledger_exists")
    manifest_hash = hashlib.sha256(manifest_raw).hexdigest()
    provider_hash = hashlib.sha256(base_url.rstrip("/").encode("utf-8")).hexdigest()
    with writer_lock(ledger_path):
        with output_path.open("x", encoding="utf-8", newline="\n") as output:
            db = create_ledger(ledger_path, manifest_sha256=manifest_hash, snapshots=snapshots,
                               model=model, provider_sha256=provider_hash, metric_version=version)
            try:
                summary = _run_batch(snapshots, output, db, base_url=base_url, model=model, key=key,
                                     timeout=timeout, version=version, concurrency=concurrency)
            finally:
                db.close()
    return {"manifest_sha256": manifest_hash,
            **summary,
            "output_path": str(output_path.resolve()), "ledger_path": str(ledger_path.resolve()),
            "usage": "unknown", "scope": "submitted_samples_model_judgments_only"}


def resume_faithfulness_batch(ledger_path: str | Path, manifest_path: str | Path, output_path: str | Path,
                              *, base_url: str, model: str, api_key_env: str = "LLM_API_KEY",
                              timeout: float = 60, concurrency: int = 4) -> dict:
    """Resume only recorded pending items, never in-flight or completed items."""
    from .faithfulness_ledger import _read_ledger, open_ledger_writer, writer_lock
    _check_concurrency(concurrency)
    key = _prepare_judge(base_url, model, api_key_env, timeout)
    version = _metric_version()
    ledger_path = Path(ledger_path).expanduser().resolve(strict=True)
    manifest_path, manifest_raw, manifest = _read_batch_manifest(manifest_path)
    output_path = Path(output_path).expanduser().resolve()
    with writer_lock(ledger_path):
        meta, rows = _read_ledger(ledger_path)
        if meta["schema_version"] != 2:
            raise ValueError("legacy_ledger_not_resumable")
        if hashlib.sha256(manifest_raw).hexdigest() != meta["manifest_sha256"]:
            raise ValueError("batch_manifest_changed")
        if (model != meta["model"] or version != meta["metric_version"]
                or hashlib.sha256(base_url.rstrip("/").encode("utf-8")).hexdigest() != meta["provider_sha256"]):
            raise ValueError("batch_judge_configuration_changed")
        existing = {item_id: (sample_hash, state) for item_id, sample_hash, state, _ in rows}
        if set(existing) != {item.id for item in manifest.samples}:
            raise ValueError("batch_manifest_items_mismatch")
        snapshots = []
        for item in manifest.samples:
            expected_hash, state = existing[item.id]
            if state == "pending":
                snapshot = _snapshot_item(manifest_path, item)
                if hashlib.sha256(snapshot[1]).hexdigest() != expected_hash:
                    raise ValueError("batch_pending_sample_changed")
                snapshots.append(snapshot)
        skipped_in_flight = sum(state == "in_flight" for _, _, state, _ in rows)
        skipped_completed = sum(state == "completed" for _, _, state, _ in rows)
        if not snapshots:
            return {"status": "nothing_pending", "requested_count": 0, "scored_count": 0,
                    "skipped_in_flight": skipped_in_flight, "skipped_completed": skipped_completed}
        with output_path.open("x", encoding="utf-8", newline="\n") as output:
            db = open_ledger_writer(ledger_path)
            try:
                summary = _run_batch(snapshots, output, db, base_url=base_url, model=model, key=key,
                                     timeout=timeout, version=version, concurrency=concurrency)
            finally:
                db.close()
    return {"status": "finished", **summary, "output_path": str(output_path),
            "ledger_path": str(ledger_path), "skipped_in_flight": skipped_in_flight,
            "skipped_completed": skipped_completed, "usage": "unknown",
            "scope": "pending_items_only_in_flight_outcomes_unknown"}


def compare_faithfulness(before_report: str | Path, after_report: str | Path,
                         before_sample: str | Path, after_sample: str | Path) -> dict:
    """Compare two reported scores only when their sample and judge identities match."""
    records = []
    for report_path, sample_path in ((before_report, before_sample), (after_report, after_sample)):
        report_raw = Path(report_path).expanduser().read_bytes()
        report = FaithfulnessReport.model_validate_json(report_raw)
        sample_raw, sample = _read_sample(sample_path)
        question_hash, contexts_hash = _sample_identity(sample)
        if (report.sample_sha256 != hashlib.sha256(sample_raw).hexdigest()
                or report.question_sha256 != question_hash or report.contexts_sha256 != contexts_hash):
            raise ValueError("sample_report_binding_mismatch")
        records.append((report, hashlib.sha256(report_raw).hexdigest()))
    first, second = records[0][0], records[1][0]
    for field in ("question_sha256", "contexts_sha256", "provider_sha256", "adapter_version",
                  "metric", "metric_version", "judge_model"):
        if getattr(first, field) != getattr(second, field):
            raise ValueError("incomparable_" + field)
    delta = None
    direction = "unknown"
    if first.status == second.status == "scored":
        delta = second.score - first.score
        direction = "improved" if delta > 0 else "regressed" if delta < 0 else "unchanged"
    return {"baseline_report_sha256": records[0][1], "candidate_report_sha256": records[1][1],
            "baseline_sample_sha256": first.sample_sha256, "candidate_sample_sha256": second.sample_sha256,
            "baseline_score": first.score, "candidate_score": second.score,
            "baseline_status": first.status, "candidate_status": second.status,
            "score_delta": delta, "direction": direction,
            "scope": "paired_model_scores_not_proof_of_truth_or_repair"}
