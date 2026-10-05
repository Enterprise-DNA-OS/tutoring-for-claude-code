---
description: "The monthly or term billing run: one invoice per family for every unbilled lesson."
---

# /bill-run

Run it with --dry-run first and show the totals by family. Run it for real only after the operator says yes in this session.

```bash
node scripts/tutoring.mjs bill-run [--to=<YYYY-MM-DD>] --dry-run
node scripts/tutoring.mjs bill-run [--to=<YYYY-MM-DD>]
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
