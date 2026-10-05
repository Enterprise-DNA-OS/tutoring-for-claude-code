---
description: "Make-up credits: available, booked, and how many days each has left."
---

# /makeups

List the credits. Lead with those expiring within 14 days.

```bash
node scripts/tutoring.mjs makeups
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
