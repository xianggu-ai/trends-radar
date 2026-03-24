# Install Reference

Use this reference when the user explicitly asks `trends-radar` to install, repair, or refresh the packaged workflow.

## Fresh-machine bootstrap path

- Prerequisites: macOS, desktop Google Chrome, `node`, `npm`, and `opencli`.
- Start from the repository root with `./scripts/install.sh`.
- After install, run `~/.codex/skills/trends-radar/scripts/doctor.sh` before the first collection attempt.

## Installed repair path

- Use `~/.codex/skills/trends-radar/scripts/install.sh` when the installed Skill bundle or the custom plugin looks stale, missing, or damaged.
- Keep the user in repair mode if the installed bundle cannot be refreshed cleanly.

## Upgrade path

- Pull the latest repo changes, then rerun `./scripts/install.sh`.
- Treat upgrades the same way as refresh installs: reinstall first, then rerun doctor.

## Expected installed locations

- Installed Skill bundle: `~/.codex/skills/trends-radar/`
- Installed scripts: `~/.codex/skills/trends-radar/scripts/`
- Runtime plugin bundle: `~/.opencli/plugins/google-trends-rising/`
