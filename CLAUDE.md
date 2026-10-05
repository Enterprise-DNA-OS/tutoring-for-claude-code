# Tutoring for Claude Code: operating instructions

This file is the brain. Claude Code reads it at the start of every session. It says who this is for, how work gets done, and the one right way to do each recurring job.

## Who this is for

- **Business:** [YOUR BUSINESS]
- **Operator:** [YOUR NAME], [your role]
- **What matters most:** [the one or two outcomes you care about]

Fill this in once. A worker with context knows. A worker without it guesses.

## How to work

1. **Take a brief, not a script.** The operator describes the outcome. You run the right command and present the answer.
2. **Read before you write.** Before drafting anything about a record, read its full history first.
3. **Plain language.** Short sentences. No filler. Numbers in tables.
4. **Silent success, loud problems.** No play-by-play. Say what broke and what you did about it.
5. **Stop at the line.** Anything that sends, deletes, or faces a customer waits for a yes in this session.

## Routing table: one right way for each recurring job

| When the operator asks for... | Use this |
|---|---|
| show a day's lessons: time, teacher, location, students and lesson codes | `/schedule` |
| list lessons across a date range, with each student and how they were marked | `/lessons` |
| mark attendance for a lesson: present, late, absent with notice (make-up issued) or absent without notice (charged) | `/mark` |
| past lessons with no attendance marked. Billing, packages, make-ups and teacher pay all wait on these | `/unmarked` |
| book a student into a new lesson, once or weekly for a number of weeks. Refuses a time the teacher already has | `/book` |
| add a student to an existing group lesson, if there is a place | `/join` |
| use a student's make-up credit to book them into another lesson | `/book-makeup` |
| cancel a lesson, with who cancelled it. Nobody in it is charged | `/cancel` |
| one student's full picture: recent lessons and attendance, packages, make-up credits and notes | `/student` |
| one family's account: students, invoices, what is unbilled, packages and notes | `/family` |
| one teacher: safety checks, this week's lessons and any findings against them | `/teacher` |
| list families with contact details, how many students and what they owe | `/families` |
| list students with family, year level, last lesson attended and next lesson booked | `/students` |
| list teachers with pay rate and the child safety checks they hold | `/teachers` |
| every child safety check on file: Working with Children Checks, blue cards, VIT registrations and NZ safety checks, with their state | `/checks` |
| everything that has gone quiet or overdue: safety check gaps, unmarked lessons, overdue invoices, packages running out, make-ups expiring, students drifting, double bookings | `/attention` |
| students drifting away: nothing booked, repeated absences, or fewer lessons than three weeks ago | `/at-risk` |
| each teacher's lessons, hours and student places for the next seven days | `/teacher-load` |
| lessons taught and charged that are on no invoice and no package | `/unbilled` |
| invoice one family for every unbilled lesson up to a date | `/bill` |
| the monthly or term billing run: one invoice per family for every unbilled lesson | `/bill-run` |
| open invoices with amount, paid, balance and days overdue | `/invoices` |
| families with an overdue balance, biggest first | `/overdue` |
| record a payment against an invoice, or against the oldest open invoice for a family | `/pay` |
| prepaid packages: minutes bought, used, left and already booked | `/packages` |
| sell a block of prepaid hours to a family and raise its invoice | `/sell-package` |
| make-up credits: available, booked, and how many days each has left | `/makeups` |
| teacher pay for a period: lessons taught, hours, rate and pay. A group lesson counts once | `/payroll` |
| check the records against the child safety and centre rules in docs/compliance.md and report each gap with its source | `/compliance` |
| answer one or all of the ten questions across the records | `/insights` |
| add a record: location, service, teacher, safety check, family, student, lesson, package, make-up, invoice, payment or note | `/add` |
| change fields on an existing record | `/update` |
| record a note against a family or a student: a call, an email, a progress note or a complaint | `/log` |
| write the Monday review from the week's lessons, what needs attention and the record checks | `/weekly-review` |
| draft a payment reminder to a family for their open invoices | `/draft-reminder` |
| draft a progress update to a family: attendance, the goal, the teacher's notes and the next lesson | `/draft-progress` |
| bring records across from Teachworks: families, students, teachers and lesson history | `/import` |
| export the whole database to a JSON backup | `/export` |
| render invoices, family statements, term progress reports, teacher timesheets and the safety check register as branded HTML | `/documents` |
| render the read-only dashboards: the week, money in, and child safety checks | `/view` |
| make this system yours in plain language. Add a field, rename stages, change a rule, add a column to a document. Writes the migration, applies it, updates the commands that touch it | `/customise` |
| add a read-only HTML view (a dashboard page) from a plain-language description, rendered in the operator's brand by `npm run view` | `/new-view` |

If an ask fits nothing here, run the CLI directly (`npm run tutoring -- help`) and then propose a new command for it.

## Hard rules

- Never send email or messages from here. Draft to `drafts/`, a person sends.
- Never delete records without an explicit yes in this session. Prefer marking closed or archived.
- Never invent a record. If a name is ambiguous, list the candidates and ask.
- Billing runs and imports go as a dry run first. The real run waits for a yes in this session.
- A teacher without a current child safety check is said first, every time it shows up.
- The database is the source of truth. If the answer is not in it, say so.

## Where things live

- `scripts/` the CLI. `scripts/lib/db.mjs` picks `DATABASE_URL` (Postgres, Supabase) or the embedded database in `.data/`.
- `supabase/migrations/` the schema, plain SQL. `npm run migrate` applies it.
- `.claude/commands/` the slash commands. Add one every time the same ask comes twice.
- `docs/` the thesis and the guide for moving off Teachworks.

Built by Enterprise DNA. Installed and run for you as part of Omni: https://enterprisedna.co/omni/instead-of/teachworks
