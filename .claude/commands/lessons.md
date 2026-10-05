---
description: "List lessons across a date range, with each student and how they were marked."
---

# /lessons

List lessons for the range the operator asks for (the next seven days if none).

```bash
node scripts/tutoring.mjs lessons --from=<YYYY-MM-DD> --to=<YYYY-MM-DD>
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
