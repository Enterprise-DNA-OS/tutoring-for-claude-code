---
description: "Add a record: location, service, teacher, safety check, family, student, lesson, package, make-up, invoice, payment or note."
---

# /add

Add the record with the fields the operator gives. Money flags (--rate, --pay-rate, --price, --amount) are dollars.

```bash
node scripts/tutoring.mjs add <kind> --field=value ...
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
