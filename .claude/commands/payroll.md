---
description: "Teacher pay for a period: lessons taught, hours, rate and pay. A group lesson counts once."
---

# /payroll

Show the pay table. Name any teacher with unmarked lessons: those are not paid until marked.

```bash
node scripts/tutoring.mjs payroll [--from=<YYYY-MM-DD>] [--to=<YYYY-MM-DD>]
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
