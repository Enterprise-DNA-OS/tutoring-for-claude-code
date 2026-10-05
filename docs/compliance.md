# Record checks

`/compliance` (or `npm run tutoring -- compliance`) runs the checks below against the records. Each check reads the `v_compliance` view in `supabase/migrations/0001_tutoring.sql`. A finding means the recorded evidence has a gap. It is not legal advice, and no findings means only that these checks found none.

Rules from law start `SAFETY-`, `AU-` or `NZ-`. Rules from your own centre policy start `POLICY-`. Which child safety rule applies depends on the `jurisdiction` of the location where the lesson happens: `NSW`, `VIC`, `QLD`, `WA`, `SA`, `TAS`, `ACT`, `NT` or `NZ`. An online class is a location too: set its jurisdiction to where the teacher works from, and check the rules where the student lives if that is a different state.

A student counts as a child when `adult` is false and they are under 18 on the lesson date. A student with no date of birth counts as a child. Mark adult students `adult = true` (the import does this for an independent student with no family).

## SAFETY-NO-CHECK

- **Applies to:** every lesson with a child at a location with a jurisdiction, in the last 90 days or the next 14.
- **Rule:** a paid tutor of children needs the working with children check of the state where the work happens. Checks do not transfer between states.
  - **Queensland:** a blue card for private teaching, coaching or tutoring of children, including a tutor employed by a tutoring business and a self-employed tutor. No card, no start. A registered teacher who tutors privately for money needs an exemption card. Source: Working with Children (Risk Management and Screening) Act 2000 (Qld); https://www.qld.gov.au/law/laws-regulated-industries-and-accountability/queensland-laws-and-regulations/regulated-industries-and-licensing/blue-card/required/individuals-businesses/private-teaching-coaching-tutoring.
  - **New South Wales:** tutors and private coaches of children need a Working with Children Check. Source: Child Protection (Working with Children) Act 2012 (NSW); Office of the Children's Guardian, https://ocg.nsw.gov.au/working-children-check.
  - **Victoria:** people who work directly with children need a WWC Check unless an exemption applies. A teacher with current Victorian Institute of Teaching registration is exempt: record it as kind `vit-registration`. Source: Worker Screening Act 2020 (Vic), https://www.legislation.vic.gov.au/in-force/acts/worker-screening-act-2020.
  - **New Zealand:** the Children's Act 2014 requires a safety check of children's workers employed or engaged by state-funded services, before they start. A private tutoring business with no state funding is not bound by the Act; many run the same check as policy, and this check treats it that way. Source: Children's Act 2014, Part 3, https://www.legislation.govt.nz/act/public/2014/0040/latest/whole.html.
  - **Other states and territories:** add the check under the right jurisdiction. The rule is the same in the data; the source column names the jurisdiction and points here. Confirm the law for that state before you rely on it.
- **In the data:** no row in `safety_checks` for that teacher and jurisdiction, of any kind except `other`, issued on or before the lesson date and not expired on it. A check that expires on the lesson date covers that lesson; one that expired the day before does not.

## AU-NSW-WWCC-VERIFY

- **Applies to:** active teachers with a NSW Working with Children Check.
- **Rule:** an employer in NSW verifies each worker's check number online and keeps a record of it. A sole trader with no employees does not register as an employer but gives their check details to the families they work for.
- **Source:** Office of the Children's Guardian, employer obligations, https://ocg.nsw.gov.au/working-children-check/organisation.
- **In the data:** a `wwcc` check in `NSW` with `verified_on` empty. Verify it on the Office of the Children's Guardian site, then `/update safety_checks <number> --verified_on=<date>`.

## NZ-SAFETY-RECHECK

- **Applies to:** active teachers with a New Zealand safety check.
- **Rule:** under the Children's Act 2014 a children's worker is safety checked again at least every three years. The periodic check repeats identity, the Police vet and the risk assessment.
- **Sources:** Children's (Requirements for Safety Checks of Children's Workers) Regulations 2015; Te Kahui Kahu, https://www.tekahuikahu.govt.nz/resources/vetting.
- **In the data:** the newest `nz-safety-check` for the teacher was verified (or issued, when no verified date is recorded) more than three years ago.

## SAFETY-EXPIRING

- **Applies to:** every check held by an active teacher.
- **Rule:** renew before expiry so the teacher can keep teaching children without a gap. In Queensland a teacher cannot work with children while the card has lapsed.
- **In the data:** `expires_on` within the next 60 days.

## POLICY-UNMARKED

- **Applies to:** every lesson that was not cancelled.
- **Rule (centre policy):** attendance is marked by the end of the next day. Billing, package hours, make-up credits and teacher pay all read it.
- **In the data:** a student in a past lesson with no `attendance`.

## POLICY-UNBILLED

- **Rule (centre policy):** every charged lesson is invoiced in the next monthly billing run.
- **In the data:** a lesson marked present, late or absent without notice, with a charge, more than 31 days old, on no invoice and no package. History imported from Teachworks counts as billed there.

## POLICY-PACKAGE-OVERDRAWN

- **Rule (centre policy):** sell the next package before the current one runs out.
- **In the data:** a package with more minutes taught against it than were bought.

## POLICY-DOUBLE-BOOKED

- **Rule (centre policy):** one teacher, one lesson at a time.
- **In the data:** two lessons for the same teacher that overlap, from a week ago onwards, neither cancelled.

## POLICY-INVOICE-OVERDUE

- **Rule:** the payment terms on the invoice (`families.payment_terms_days`, 14 by default).
- **In the data:** an issued invoice past its due date with a balance owing.

## Changing a rule

Ask `/customise` in plain words ("late cancellations within 24 hours are charged", "make-up credits last eight weeks"). It writes a new migration that replaces `v_compliance`, updates this file and adds a test. Never edit an applied migration.
