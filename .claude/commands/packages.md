---
description: "Prepaid packages: minutes bought, used, left and already booked."
---

# /packages

List them. Lead with any package overdrawn or that runs out before the lessons already booked.

```bash
node scripts/tutoring.mjs packages
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
