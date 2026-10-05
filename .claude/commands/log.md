---
description: "Record a note against a family or a student: a call, an email, a progress note or a complaint."
---

# /log

Log it in the operator's words.

```bash
node scripts/tutoring.mjs log "<family or student>" <note text> [--kind=call|email|progress|complaint] [--title="..."]
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
