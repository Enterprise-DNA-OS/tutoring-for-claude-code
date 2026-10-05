---
description: "Answer one or all of the ten questions across the records."
---

# /insights

Run the question the operator asks for, or all ten. Say what each answer means for the business in one line.

```bash
node scripts/tutoring.mjs insights [1-10]
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
