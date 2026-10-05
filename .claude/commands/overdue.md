---
description: "Families with an overdue balance, biggest first."
---

# /overdue

List them and offer /draft-reminder for each.

```bash
node scripts/tutoring.mjs overdue
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
