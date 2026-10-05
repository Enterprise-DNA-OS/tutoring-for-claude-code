---
description: "Record a payment against an invoice, or against the oldest open invoice for a family."
---

# /pay

Record it and say the balance left.

```bash
node scripts/tutoring.mjs pay <invoice number or family> --amount=<dollars> [--method="card"] [--reference="..."] [--on=<YYYY-MM-DD>]
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
