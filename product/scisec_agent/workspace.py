"""Read-only inspection of a proposed user-selected workspace.

This module never executes a target or asserts an OS isolation boundary.
"""

from pathlib import Path
import shutil


def inspect_workspace(directory: str | Path) -> dict:
    requested = Path(directory).expanduser()
    try:
        resolved = requested.resolve(strict=True)
    except (OSError, RuntimeError) as exc:
        raise ValueError("workspace_not_accessible") from exc
    if not resolved.is_dir():
        raise ValueError("workspace_not_directory")
    try:
        available_bytes = shutil.disk_usage(resolved).free
    except OSError:
        available_bytes = None
    return {
        "requested_path": str(requested),
        "resolved_path": str(resolved),
        "workspace_exists": True,
        "filesystem_available_bytes": available_bytes,
        "filesystem_space_status": ("unknown" if available_bytes is None else
                                    "full" if available_bytes == 0 else "available"),
        "execution_enabled": False,
        "isolation_backend": "unverified",
        "isolation_enforced": False,
        "file_access_verified": False,
        "network_restriction_verified": False,
    }
