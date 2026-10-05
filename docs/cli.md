# CLI reference

Every slash command drives one CLI: `node scripts/tutoring.mjs <command>` (or `npm run tutoring -- <command>`). Human tables by default; add `--json` for machines. Names match without case, partial ids work, and an ambiguous name lists the candidates and exits 1.

## Commands

```
families
students
teachers
checks
services
locations
lessons [--from=date --to=date]
unmarked
unbilled
invoices
overdue
packages
makeups
compliance
at-risk
teacher-load
schedule [--on=date] [--teacher=name]
student <student>
family <family>
teacher <teacher>
attention
insights [1..10]
book <student> --service= --teacher= --location= --at="YYYY-MM-DD HH:MM" [--minutes=60] [--weeks=1]
join <lesson> <student>
mark <lesson> --as=present|late|absent-notice|absent-no-notice [--student=name] [--note=...]
cancel <lesson> --by=teacher|centre|weather
book-makeup <student> --lesson=<lesson>
bill <family> [--to=date] [--dry-run]
bill-run [--to=date] [--dry-run]
pay <invoice|family> --amount=dollars [--method=] [--reference=]
sell-package <family> --student= --hours= --price=dollars [--expires=date]
payroll [--from=date --to=date]
show <kind> <name|id>
add <kind> --field=value
update <kind> <name|id> --field=value
log <family|student> <note> [--kind=call|email|progress|complaint]
import teachworks --kind=families|students|teachers|lessons --file=export.csv [--currency=AUD] [--dry-run]
export --out=backup.json
weekly-review
draft-reminder <family>
draft-progress <student>
```

## Notes

- Every command takes --json. Money flags (--rate, --pay-rate, --price, --amount) are dollars; *_cents fields are cents. Reference fields accept names or ids. Lessons are named by the 8-character code in schedule and lessons.
- Reads: families, students, teachers, checks, services, locations, lessons, unmarked, unbilled, invoices, overdue, packages, makeups, compliance, at-risk, teacher-load.
- Writes that move money (bill, bill-run, pay, sell-package) and every import run in one transaction. `--dry-run` rolls back after showing the result.
- Drafts (weekly-review, draft-reminder, draft-progress) are written to `drafts/` and never sent.
- Kinds for show, add and update: locations, services, teachers, safety_checks, families, students, lessons, packages, makeups, invoices, payments, notes. Attendance is changed with mark, invoice lines with bill.

## Examples

```bash
npm run tutoring -- schedule --on=2026-10-06
npm run tutoring -- mark 6c4671ba --as=present
npm run tutoring -- mark --teacher="Ben Carter" --on=2026-10-05 --at=17:00 --as=absent-no-notice
npm run tutoring -- book "Mia Nguyen" --service="English Writing Group" --teacher=Chloe --location=Chatswood --at="2026-10-13 16:30" --weeks=10
npm run tutoring -- bill-run --dry-run
npm run tutoring -- payroll --from=2026-09-22 --to=2026-10-05
npm run tutoring -- insights 5 --json
```
