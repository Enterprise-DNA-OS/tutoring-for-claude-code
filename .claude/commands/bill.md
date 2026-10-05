---
description: "Invoice one family for every unbilled lesson up to a date."
---

# /bill

Do a dry run first if the operator is unsure. Then bill and report the invoice number, lines and total.

```bash
node scripts/tutoring.mjs bill "<family>" [--to=<YYYY-MM-DD>] [--dry-run]
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
