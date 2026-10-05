---
description: "Draft a payment reminder to a family for their open invoices."
---

# /draft-reminder

Draft it, show it, and say where it was saved. A person sends it.

```bash
node scripts/tutoring.mjs draft-reminder "<family>"
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
