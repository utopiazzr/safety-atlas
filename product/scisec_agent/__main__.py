"""Product-facing read-only workspace, task, and evidence commands."""

import argparse
import json
import sqlite3
import sys

from pydantic import ValidationError

from .workspace import inspect_workspace


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog=f"python -m {__package__}")
    commands = parser.add_subparsers(dest="command", required=True)
    quick = commands.add_parser("quickstart", help="Run a real local normal function and generate your first plugin report")
    quick.add_argument("--output", help="A new folder for this first run")
    quick.add_argument("--open", action="store_true", help="Open the resulting local HTML report")
    inspect = commands.add_parser("inspect-workspace", help="Inspect a directory without running tests")
    inspect.add_argument("directory")
    catalog = commands.add_parser("list-tasks", help="List the existing task bank without running or classifying tasks")
    catalog.add_argument("project_root")
    report = commands.add_parser("summarize-episode", help="Summarize an existing episode without running it")
    report.add_argument("episode")
    comparison = commands.add_parser("compare-episodes", help="Compare two compatible episodes")
    comparison.add_argument("baseline")
    comparison.add_argument("candidate")
    behavior = commands.add_parser("assess-behavior", help="Assess an existing structured behavior trace")
    behavior.add_argument("trace")
    behavior.add_argument("--policy", help="Separate JSON action/resource policy")
    behavior_compare = commands.add_parser("compare-behavior", help="Compare matching behavior traces under one policy")
    behavior_compare.add_argument("baseline")
    behavior_compare.add_argument("candidate")
    behavior_compare.add_argument("--policy", required=True)
    otel = commands.add_parser("summarize-otel", help="Summarize OpenTelemetry OTLP JSON tool spans")
    otel.add_argument("trace")
    otel.add_argument("--tool-policy", help="Separate JSON file with a tool-name allowlist")
    monitor = commands.add_parser("summarize-monitor", help="Summarize a closed local tool-monitor event file")
    monitor.add_argument("events")
    guard = commands.add_parser("summarize-guard", help="Summarize saved tool-policy decisions")
    guard.add_argument("events")
    faithfulness = commands.add_parser("evaluate-faithfulness", help="Evaluate an answer against supplied context")
    faithfulness.add_argument("sample")
    faithfulness.add_argument("--base-url", required=True)
    faithfulness.add_argument("--model", required=True)
    faithfulness.add_argument("--api-key-env", default="LLM_API_KEY")
    faithfulness.add_argument("--timeout", type=float, default=60)
    faith_batch = commands.add_parser("evaluate-faithfulness-batch", help="Evaluate a batch of answers against contexts")
    faith_batch.add_argument("manifest")
    faith_batch.add_argument("output")
    faith_batch.add_argument("--base-url", required=True)
    faith_batch.add_argument("--model", required=True)
    faith_batch.add_argument("--api-key-env", default="LLM_API_KEY")
    faith_batch.add_argument("--timeout", type=float, default=60)
    faith_batch.add_argument("--concurrency", type=int, default=4)
    faith_batch.add_argument("--ledger", help="Store the SQLite ledger separately on a local filesystem")
    resume_batch = commands.add_parser("resume-faithfulness-batch", help="Resume only never-started batch items")
    resume_batch.add_argument("ledger")
    resume_batch.add_argument("manifest")
    resume_batch.add_argument("output")
    resume_batch.add_argument("--base-url", required=True)
    resume_batch.add_argument("--model", required=True)
    resume_batch.add_argument("--api-key-env", default="LLM_API_KEY")
    resume_batch.add_argument("--timeout", type=float, default=60)
    resume_batch.add_argument("--concurrency", type=int, default=4)
    inspect_batch = commands.add_parser("inspect-faithfulness-batch", help="Inspect recorded batch states")
    inspect_batch.add_argument("ledger")
    export_batch = commands.add_parser("export-faithfulness-batch", help="Export completed batch records")
    export_batch.add_argument("ledger")
    export_batch.add_argument("output")
    compare_batches = commands.add_parser("compare-faithfulness-batches", help="Compare paired batch ledgers")
    compare_batches.add_argument("baseline_ledger")
    compare_batches.add_argument("candidate_ledger")
    compare_faith = commands.add_parser("compare-faithfulness", help="Compare compatible context-support scores")
    compare_faith.add_argument("baseline_report")
    compare_faith.add_argument("candidate_report")
    compare_faith.add_argument("--baseline-sample", required=True)
    compare_faith.add_argument("--candidate-sample", required=True)
    external = commands.add_parser("agenthop-task", help="Read one local AgentHop question without its answer")
    external.add_argument("dataset_file")
    external.add_argument("sample_id")
    prepare = commands.add_parser("agenthop-prepare", help="Prepare selected questions without answer keys")
    prepare.add_argument("dataset_file")
    prepare.add_argument("sample_ids", nargs="+")
    score = commands.add_parser("agenthop-score", help="Score one answer against a local AgentHop record")
    score.add_argument("dataset_file")
    score.add_argument("sample_id")
    score.add_argument("answer_index", type=int)
    batch = commands.add_parser("agenthop-evaluate", help="Grade a local JSONL file of submitted answers")
    batch.add_argument("dataset_file")
    batch.add_argument("answers_file")
    batch.add_argument("--prepared", help="Verify the answers against a previously prepared task bundle")
    run = commands.add_parser("agenthop-run", help="Send prepared questions to an OpenAI-compatible endpoint")
    run.add_argument("dataset_file")
    run.add_argument("prepared_file")
    run.add_argument("answers_file")
    run.add_argument("--base-url", required=True)
    run.add_argument("--model", required=True)
    run.add_argument("--api-key-env", default="LLM_API_KEY")
    run.add_argument("--timeout", type=float, default=60)
    pipeline = commands.add_parser("run-pipeline", help="Build one non-attack evaluation, monitoring and remediation report")
    pipeline.add_argument("manifest")
    pipeline.add_argument("output")
    pipeline.add_argument("--html", help="Also write a standalone private report page")
    args = parser.parse_args(argv)
    try:
        if args.command == "quickstart":
            from .quickstart import quickstart
            result = quickstart(args.output, open_report=args.open)
        elif args.command == "inspect-workspace":
            result = inspect_workspace(args.directory)
        elif args.command == "list-tasks":
            from .tasks import list_tasks
            result = {"tasks": list_tasks(args.project_root), "execution_enabled": False}
        elif args.command == "summarize-episode":
            from .results import summarize_episode
            result = summarize_episode(args.episode)
        elif args.command == "compare-episodes":
            from .results import compare_episodes
            result = compare_episodes(args.baseline, args.candidate)
        elif args.command == "assess-behavior":
            from .behavior import assess_behavior
            result = assess_behavior(args.trace, args.policy)
        elif args.command == "compare-behavior":
            from .behavior import compare_behavior
            result = compare_behavior(args.baseline, args.candidate, args.policy)
        elif args.command == "summarize-otel":
            from .telemetry import summarize_otel
            result = summarize_otel(args.trace, args.tool_policy)
        elif args.command == "summarize-monitor":
            from .monitor_events import summarize_monitor_events
            result = summarize_monitor_events(args.events)
        elif args.command == "summarize-guard":
            from .guard_events import summarize_guard_events
            result = summarize_guard_events(args.events)
        elif args.command == "evaluate-faithfulness":
            from .faithfulness import evaluate_faithfulness
            result = evaluate_faithfulness(args.sample, base_url=args.base_url, model=args.model,
                                           api_key_env=args.api_key_env, timeout=args.timeout)
        elif args.command == "evaluate-faithfulness-batch":
            from .faithfulness import evaluate_faithfulness_batch
            result = evaluate_faithfulness_batch(args.manifest, args.output, base_url=args.base_url,
                                                 model=args.model, api_key_env=args.api_key_env,
                                                 timeout=args.timeout, concurrency=args.concurrency,
                                                 ledger_path=args.ledger)
        elif args.command == "resume-faithfulness-batch":
            from .faithfulness import resume_faithfulness_batch
            result = resume_faithfulness_batch(args.ledger, args.manifest, args.output, base_url=args.base_url,
                                               model=args.model, api_key_env=args.api_key_env,
                                               timeout=args.timeout, concurrency=args.concurrency)
        elif args.command == "inspect-faithfulness-batch":
            from .faithfulness_ledger import inspect_ledger
            result = inspect_ledger(args.ledger)
        elif args.command == "export-faithfulness-batch":
            from .faithfulness_ledger import export_ledger
            result = export_ledger(args.ledger, args.output)
        elif args.command == "compare-faithfulness-batches":
            from .faithfulness_ledger import compare_ledgers
            result = compare_ledgers(args.baseline_ledger, args.candidate_ledger)
        elif args.command == "compare-faithfulness":
            from .faithfulness import compare_faithfulness
            result = compare_faithfulness(args.baseline_report, args.candidate_report,
                                          args.baseline_sample, args.candidate_sample)
        elif args.command == "agenthop-task":
            from .agenthop import task_view
            result = task_view(args.dataset_file, args.sample_id)
        elif args.command == "agenthop-prepare":
            from .agenthop import prepare_tasks
            result = prepare_tasks(args.dataset_file, args.sample_ids)
        elif args.command == "agenthop-score":
            from .agenthop import score_answer
            result = score_answer(args.dataset_file, args.sample_id, args.answer_index)
        elif args.command == "agenthop-evaluate":
            from .agenthop import score_answers
            result = score_answers(args.dataset_file, args.answers_file, args.prepared)
        elif args.command == "agenthop-run":
            from .agenthop_runner import run_questions
            result = run_questions(args.dataset_file, args.prepared_file, args.answers_file,
                                   base_url=args.base_url, model=args.model,
                                   api_key_env=args.api_key_env, timeout_seconds=args.timeout)
        else:
            from .pipeline import run_pipeline
            result = run_pipeline(args.manifest, args.output, args.html)
    except sqlite3.Error:
        print(json.dumps({"error": "batch_ledger_error"}), file=sys.stderr)
        return 2
    except ValidationError:
        print(json.dumps({"error": "invalid_input_schema"}), file=sys.stderr)
        return 2
    except (ValueError, OSError) as exc:
        print(json.dumps({"error": str(exc)}), file=sys.stderr)
        return 2
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 3 if ((args.command == "agenthop-run" and result["failed_count"])
                 or (args.command == "evaluate-faithfulness" and result["status"] != "scored")
                 or (args.command == "evaluate-faithfulness-batch"
                     and result["scored_count"] != result["requested_count"])
                 or (args.command == "resume-faithfulness-batch"
                     and result["scored_count"] != result["requested_count"])) else 0


if __name__ == "__main__":
    raise SystemExit(main())
