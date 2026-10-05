---
description: "Export the whole database to a JSON backup."
---

# /export

Export to the file the operator names. The command refuses to overwrite a file.

```bash
node scripts/tutoring.mjs export --out=<backup.json>
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
