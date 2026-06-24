#!/usr/bin/env python3
"""PreToolUse guard for Hotfire (bypassPermissions) mode.

Under `bypassPermissions` the settings `ask`/`allow` lists are ignored, so a
PreToolUse hook is the ONLY thing that can still force a prompt. Hooks run in
every permission mode, and a hook returning permissionDecision "ask" forces a
confirmation prompt even when the mode would otherwise auto-allow the tool.

This guard forces a prompt ("ask") for exactly the two categories Hotfire must
never run unattended, and stays silent (falls through to auto-allow) otherwise:

  1. Deletions of files OUTSIDE this project (rm/rmdir/unlink, find -delete).
  2. Network downloads/fetches (curl, wget, git clone, package installs, npx,
     ...) so a human can rule out anything malicious before it runs.

Conservative by design: when it cannot prove a deletion stays in-scope (e.g. an
rm combined with cd), it asks.
"""

import json
import os
import shlex
import sys

# ---- per-project config -------------------------------------------------
PROJECT = "/Users/lukasbieneman/VSCodeProjects/BodybuildingApp"
# Roots where deletions run without a prompt (project + declared scratch dirs).
ALLOWED_DELETE_ROOTS = [PROJECT, "/tmp"]
# Gate pip installs like any other download for this project.
ALLOW_PIP = False
# -------------------------------------------------------------------------

SEPARATORS = {";", "&&", "||", "|", "&", "(", ")", "{", "}"}
# Leading command wrappers to look through to find the real command head.
WRAPPERS = {"sudo", "command", "nohup", "time", "nice", "ionice", "env",
            "xargs", "stdbuf", "exec", "builtin"}
DELETERS = {"rm", "rmdir", "unlink"}

# Commands that always fetch from the network (no subcommand needed).
DOWNLOAD_HEADS = {"curl", "wget", "scp", "sftp", "ftp", "rsync",
                  "npx", "bunx", "pnpx", "dlx"}
# (command, subcommand) pairs that fetch/install from a remote source.
DOWNLOAD_PAIRS = {
    ("git", "clone"),
    ("npm", "install"), ("npm", "i"), ("npm", "ci"), ("npm", "add"),
    ("pnpm", "add"), ("pnpm", "install"), ("pnpm", "i"),
    ("yarn", "add"), ("bun", "add"), ("bun", "install"),
    ("brew", "install"), ("brew", "tap"),
    ("gem", "install"), ("pod", "install"),
    ("cargo", "install"), ("go", "install"), ("go", "get"),
    ("apt", "install"), ("apt-get", "install"),
    ("pip", "install"), ("pip3", "install"), ("pipx", "install"),
    ("uv", "pip"), ("uv", "add"), ("conda", "install"),
}


def ask(reason):
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "ask",
            "permissionDecisionReason": reason,
        }
    }))
    sys.exit(0)


def is_pip(head, sub):
    return (head, sub) in (("pip", "install"), ("pip3", "install"),
                           ("pipx", "install")) or (head, sub) == ("uv", "pip")


def split_segments(tokens):
    """Split a token stream into command segments on shell separators."""
    seg, out = [], []
    for t in tokens:
        if t in SEPARATORS:
            if seg:
                out.append(seg)
                seg = []
        else:
            seg.append(t)
    if seg:
        out.append(seg)
    return out


def effective_command(seg):
    """Strip leading wrappers / env assignments; return (head, args)."""
    i, n = 0, len(seg)
    while i < n:
        t = seg[i]
        if t in WRAPPERS:
            i += 1
            while i < n and seg[i].startswith("-"):  # wrapper flags
                i += 1
            continue
        # leading VAR=value environment assignment (e.g. MPLBACKEND=Agg cmd)
        if ("=" in t and not t.startswith("-") and not t.startswith("/")
                and t.split("=", 1)[0].isidentifier()):
            i += 1
            continue
        break
    if i >= n:
        return None, []
    head = os.path.basename(seg[i])  # /usr/bin/python3 -> python3
    return head, seg[i + 1:]


def check_download(head, args):
    sub = args[0] if args else None
    if head in DOWNLOAD_HEADS:
        ask(f"network fetch via {head!r} — review before running")
    if sub and (head, sub) in DOWNLOAD_PAIRS:
        if ALLOW_PIP and is_pip(head, sub):
            return
        ask(f"network install via {head} {sub} — review before running")
    # python -m pip install ...
    if head in ("python", "python3") and "-m" in args:
        m = args.index("-m")
        rest = args[m + 1:]
        if rest[:1] == ["pip"] and "install" in rest:
            if not ALLOW_PIP:
                ask("network install via python -m pip install — review before running")


def check_deletion(head, args, whole_tokens):
    if head not in DELETERS and not (head == "find" and "-delete" in args):
        return
    # An rm/find with cd anywhere: cannot prove the target stays in scope.
    if "cd" in whole_tokens:
        ask("deletion combined with cd: cannot verify it stays inside the project")
    targets = args
    if head == "find":
        # find <paths> ... -delete ; treat leading non-flag tokens as roots
        targets = []
        for t in args:
            if t.startswith("-"):
                break
            targets.append(t)
    for t in targets:
        if t.startswith("-"):
            continue
        if t.startswith("~"):
            ask(f"deletion targets {t!r}, a home-relative path outside the project")
        abspath = (os.path.abspath(t) if t.startswith("/")
                   else os.path.abspath(os.path.join(PROJECT, t)))
        if not any(abspath == root or abspath.startswith(root + os.sep)
                   for root in ALLOWED_DELETE_ROOTS):
            ask(f"deletion targets {t!r}, which resolves outside the project")


def main():
    try:
        data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        return
    cmd = (data.get("tool_input") or {}).get("command") or ""
    if not cmd.strip():
        return
    try:
        tokens = shlex.split(cmd)
    except ValueError:
        tokens = cmd.split()
    for seg in split_segments(tokens):
        head, args = effective_command(seg)
        if head is None:
            continue
        check_download(head, args)
        check_deletion(head, args, tokens)


if __name__ == "__main__":
    main()
    sys.exit(0)
