"""Expose the existing task library without executing or classifying tasks."""

from pathlib import Path

def list_tasks(project_root: str | Path) -> list[dict]:
    try:
        from scisec.task_builder.loader import TaskLibrary
    except ModuleNotFoundError as exc:
        if exc.name in {"scisec", "scisec.task_builder"}:
            raise ValueError("scisec_task_library_not_installed") from exc
        raise
    bank = Path(project_root).expanduser().resolve() / "task_bank"
    if not bank.is_dir():
        raise ValueError("task_bank_not_found")
    library = TaskLibrary(bank)
    tasks = []
    for task_id in sorted(library.list_ids()):
        task = library.get(task_id)
        metadata = task.metadata or {}
        tasks.append({
            "task_id": task.task_id,
            "goal": task.goal,
            "domain": task.domain,
            "subtype": task.subtype,
            "input_files": task.input_files,
            "reference_outputs": task.reference_outputs,
            "source": metadata.get("source"),
            "is_synthetic": metadata.get("is_synthetic"),
            "runnable": metadata.get("runnable"),
        })
    return tasks
