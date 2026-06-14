#!/usr/bin/env python3
"""PreToolUse guard: force a permission prompt for any rm that deletes
files outside this project, regardless of permission mode.

Outputs an "ask" decision when an rm invocation references a path that
resolves outside the project root (or can't be verified, e.g. rm combined
with cd). Outputs nothing otherwise, falling through to the normal
permission flow.
"""

import json
import os
import shlex
import sys

PROJECT = "/Users/lukasbieneman/BodybuildingApp"
SEPARATORS = {";", "&&", "||", "|", "&"}
WRAPPERS = {"sudo", "xargs", "exec", "-exec", "command", "env"}


def ask(reason):
    print(
        json.dumps(
            {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "ask",
                    "permissionDecisionReason": reason,
                }
            }
        )
    )
    sys.exit(0)


def main():
    try:
        data = json.load(sys.stdin)
    except json.JSONDecodeError:
        return
    cmd = (data.get("tool_input") or {}).get("command") or ""
    if "rm" not in cmd:
        return
    try:
        tokens = shlex.split(cmd)
    except ValueError:
        tokens = cmd.split()

    rm_positions = [
        i
        for i, t in enumerate(tokens)
        if t == "rm" and (i == 0 or tokens[i - 1] in SEPARATORS or tokens[i - 1] in WRAPPERS)
    ]
    if not rm_positions:
        return

    if any(t == "cd" for t in tokens):
        ask("rm combined with cd: cannot verify the deletion stays inside the project")

    for i in rm_positions:
        for t in tokens[i + 1 :]:
            if t in SEPARATORS:
                break
            if t.startswith("-"):
                continue
            if t.startswith("~"):
                ask(f"rm targets {t!r}, a home-relative path outside the project")
            abspath = (
                os.path.abspath(t)
                if t.startswith("/")
                else os.path.abspath(os.path.join(PROJECT, t))
            )
            if abspath != PROJECT and not abspath.startswith(PROJECT + os.sep):
                ask(f"rm targets {t!r}, which resolves outside the project")


if __name__ == "__main__":
    main()
    sys.exit(0)
