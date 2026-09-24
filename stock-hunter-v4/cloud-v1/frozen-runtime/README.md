# Frozen Runtime Pin

This directory pins the exact repository objects that define the current frozen production Hunt/session identity for cloud extraction work.

The Git blob SHA is intentionally used because `git hash-object <file>` can verify it without network access or external dependencies.

Before any cloud scorer is allowed to claim `4.1.6-hunt-v2` parity:

1. these pinned source objects must still match;
2. the generated/shared runtime must be produced deterministically from reviewed source;
3. the existing parity harness plus new cloud parity fixtures must pass;
4. browser and cloud results must match on identical inputs under a controlled historical/current clock;
5. no formula/threshold/objective/session change may be hidden inside adapter code.

This manifest is a safety pin, not authorization to edit the frozen sources.
