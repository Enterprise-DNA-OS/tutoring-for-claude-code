---
description: "Sell a block of prepaid hours to a family and raise its invoice."
---

# /sell-package

Confirm the student, hours and price, then record it.

```bash
node scripts/tutoring.mjs sell-package "<family>" --student="<student>" --hours=<hours> --price=<dollars> [--expires=<YYYY-MM-DD>] [--name="Term 4 block"]
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
