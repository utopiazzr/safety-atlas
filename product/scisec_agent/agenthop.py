"""Read AgentHop question records without importing its executable loader.

Dataset: https://huggingface.co/datasets/nlpai-lab/agenthop, CC BY 4.0.
This is a question-only adapter, not the original retrieval evaluation.
"""

import hashlib
import json
from pathlib import Path


def _load_questions(path: str | Path, sample_ids: set[str]) -> tuple[dict[str, dict], str]:
    digest = hashlib.sha256()
    found = {}
    with Path(path).expanduser().open("rb") as stream:
        for raw in stream:
            digest.update(raw)
            if not raw.strip():
                continue
            row = json.loads(raw)
            if not isinstance(row, dict):
                raise ValueError("invalid_agenthop_row")
            sample_id = row.get("id")
            if isinstance(sample_id, str) and sample_id in sample_ids:
                if sample_id in found:
                    raise ValueError("duplicate_sample_id")
                found[sample_id] = row
    if found.keys() != sample_ids:
        raise ValueError("sample_not_found")
    for row in found.values():
        options = row.get("options")
        index = row.get("correct_index")
        if (not isinstance(row.get("question"), str) or not isinstance(options, list)
                or len(options) != 4 or not all(isinstance(item, str) for item in options)
                or type(index) is not int or index not in range(4)):
            raise ValueError("invalid_agenthop_question")
    return found, digest.hexdigest()


def load_question(path: str | Path, sample_id: str) -> tuple[dict, str]:
    found, digest = _load_questions(path, {sample_id})
    return found[sample_id], digest


def _task_view(row: dict, digest: str) -> dict:
    return {
        "source": "nlpai-lab/agenthop",
        "source_url": "https://huggingface.co/datasets/nlpai-lab/agenthop",
        "license": "CC-BY-4.0",
        "source_file_sha256": digest,
        "sample_id": row["id"],
        "question": row["question"],
        "options": row["options"],
        "seed_arxiv_id": row.get("seed_arxiv_id"),
        "seed_title": row.get("seed_title"),
        "scope": "question_only_not_official_agenthop_evaluation",
    }


def task_view(path: str | Path, sample_id: str) -> dict:
    row, digest = load_question(path, sample_id)
    return _task_view(row, digest)


def prepare_tasks(path: str | Path, sample_ids: list[str]) -> dict:
    if not sample_ids or any(not isinstance(sid, str) or not sid for sid in sample_ids):
        raise ValueError("invalid_sample_ids")
    if len(set(sample_ids)) != len(sample_ids):
        raise ValueError("duplicate_sample_id")
    rows, digest = _load_questions(path, set(sample_ids))
    return {
        "source": "nlpai-lab/agenthop",
        "source_file_sha256": digest,
        "task_count": len(sample_ids),
        "tasks": [_task_view(rows[sid], digest) for sid in sample_ids],
        "scope": "question_only_not_official_agenthop_evaluation",
    }


def validate_prepared(dataset_path: str | Path, prepared: object) -> dict:
    """Rebuild a prepared bundle from its source and compare every public field."""
    if not isinstance(prepared, dict) or not isinstance(prepared.get("tasks"), list):
        raise ValueError("invalid_prepared_tasks")
    tasks = prepared["tasks"]
    if any(not isinstance(task, dict) for task in tasks):
        raise ValueError("invalid_prepared_tasks")
    expected = prepare_tasks(dataset_path, [task.get("sample_id") for task in tasks])
    if expected != prepared:
        raise ValueError("prepared_task_mismatch")
    return expected


def score_answer(path: str | Path, sample_id: str, answer_index: int) -> dict:
    if type(answer_index) is not int or answer_index not in range(4):
        raise ValueError("answer_index_out_of_range")
    row, digest = load_question(path, sample_id)
    return {
        "source": "nlpai-lab/agenthop",
        "source_file_sha256": digest,
        "sample_id": sample_id,
        "answer_index": answer_index,
        "correct": answer_index == row["correct_index"],
        "scope": "single_question_not_official_agenthop_evaluation",
    }


def score_answers(dataset_path: str | Path, answers_path: str | Path,
                  prepared_path: str | Path | None = None) -> dict:
    """Grade submitted answers; missing dataset samples are errors, not failures."""
    raw = Path(answers_path).expanduser().read_bytes()
    answers = []
    seen = set()
    for line in raw.splitlines():
        if not line.strip():
            continue
        row = json.loads(line)
        if not isinstance(row, dict) or not isinstance(row.get("sample_id"), str) or not row["sample_id"]:
            raise ValueError("invalid_answer_row")
        index = row.get("answer_index")
        if type(index) is not int or index not in range(4):
            raise ValueError("answer_index_out_of_range")
        if row["sample_id"] in seen:
            raise ValueError("duplicate_answer_id")
        seen.add(row["sample_id"])
        answers.append((row["sample_id"], index))
    if not answers:
        raise ValueError("no_answers")
    prepared_hash = None
    prepared_count = None
    tasks = None
    prepared = None
    if prepared_path is not None:
        prepared_raw = Path(prepared_path).expanduser().read_bytes()
        prepared = json.loads(prepared_raw)
        if not isinstance(prepared, dict) or prepared.get("source") != "nlpai-lab/agenthop":
            raise ValueError("invalid_prepared_tasks")
        tasks = prepared.get("tasks")
        if not isinstance(tasks, list) or any(not isinstance(t, dict) or not isinstance(t.get("sample_id"), str) for t in tasks):
            raise ValueError("invalid_prepared_tasks")
        ids = [task["sample_id"] for task in tasks]
        if not ids or any(not sid for sid in ids) or len(ids) != len(set(ids)) or prepared.get("task_count") != len(ids):
            raise ValueError("invalid_prepared_tasks")
        if not seen.issubset(ids):
            raise ValueError("answer_not_prepared")
        prepared_hash = hashlib.sha256(prepared_raw).hexdigest()
        prepared_count = len(ids)
    questions, digest = _load_questions(dataset_path, set(ids) if tasks is not None else seen)
    if prepared is not None:
        if prepared.get("source_file_sha256") != digest:
            raise ValueError("prepared_source_mismatch")
        # The whole prepared bundle must still match the supplied dataset.
        if any(_task_view(questions[task["sample_id"]], digest) != task for task in tasks):
            raise ValueError("prepared_task_mismatch")
    results = [{"sample_id": sid, "answer_index": index,
                "correct": index == questions[sid]["correct_index"]} for sid, index in answers]
    correct = sum(item["correct"] for item in results)
    return {
        "source": "nlpai-lab/agenthop",
        "source_file_sha256": digest,
        "answers_sha256": hashlib.sha256(raw).hexdigest(),
        "prepared_sha256": prepared_hash,
        "prepared_source_binding_verified": prepared_hash is not None,
        "prepared_count": prepared_count,
        "unsubmitted_count": prepared_count - len(results) if prepared_count is not None else None,
        "submitted_count": len(results),
        "correct_count": correct,
        "submitted_accuracy": correct / len(results),
        "results": results,
        "scope": "submitted_questions_only_not_official_agenthop_evaluation",
    }
