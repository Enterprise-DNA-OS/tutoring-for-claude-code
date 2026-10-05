---
description: "Change fields on an existing record."
---

# /update

Read the record first, then change only the fields asked for.

```bash
node scripts/tutoring.mjs update <kind> "<name or id>" --field=value
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
