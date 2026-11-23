# Using ASL as a gate

`--fail-under` turns the audit into a CI check: if any weakness is accepted more often than the
threshold, the process exits **4**.

```sh
python3 asl.py audit --n 6 --jobs 4 --fail-under 0.5
```

Exit codes:

| Code | Meaning |
|---|---|
| 0 | clean, or no weakness above the threshold |
| 4 | at least one weakness above the threshold |
| 3 | a precondition was not met (no target, no provider, short sessions) |
| 2 | usage error |
| 1 | unexpected error |

## Why the threshold and not "zero findings"

Acceptance is a **rate**, not a yes/no. Two runs of the same cell can return different verdicts;
`REPRODUCIBILITY.md` shows a cell returning CONFIRMED 1 / NOT_EXECUTED 2 / UNDER_EXPOSED 3 across
six identical runs. A gate that fails on a single hit will flap.

Set the threshold from your own baseline: run the audit a few times, look at the spread, and put
the gate above the noise floor. `--fail-under 0.5` means "fail if more than half of measured runs
went wrong".

## Why not on every PR

An audit costs N agent invocations per weakness per run. Run it on a schedule (weekly) or on
demand, and re-run when you change the model version, the agent's instruction files, or its tool
policy — the events that actually move the numbers.

## Minimum sample

Below 6 measured samples the reported rate is not a rate. The tool marks those rows
`sufficient: false` and `--fail-under` ignores them, so a thin run cannot fail your build for the
wrong reason.
