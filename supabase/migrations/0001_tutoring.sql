-- Tutoring for Claude Code: families, students, teachers, lessons, attendance, packages,
-- invoices, payments, make-up credits and child safety checks for a tutoring centre,
-- music school or language school. Runs on Postgres and PGlite. Money is in cents.
create function touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;

-- A location is a room, a branch or an online class. jurisdiction decides which child
-- safety check a teacher needs to teach children there (see docs/compliance.md).
create table locations (
 id uuid primary key default gen_random_uuid(),
 name text not null unique,
 jurisdiction text check (jurisdiction in ('NSW','VIC','QLD','WA','SA','TAS','ACT','NT','NZ')),
 currency text not null default 'AUD' check (currency ~ '^[A-Z]{3}$'),
 address text not null default '',
 online boolean not null default false,
 active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- A service is what a family buys: "Year 10 Maths, 1:1" or "Piano, 30 minutes".
-- rate_cents is the price per student per hour; max_students above 1 makes it a group class.
create table services (
 id uuid primary key default gen_random_uuid(),
 name text not null unique,
 subject text not null default '',
 rate_cents integer not null check (rate_cents >= 0),
 max_students integer not null default 1 check (max_students >= 1),
 active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- pay_rate_cents is what the teacher is paid per teaching hour.
create table teachers (
 id uuid primary key default gen_random_uuid(),
 name text not null unique,
 email text,
 phone text,
 pay_rate_cents integer not null default 0 check (pay_rate_cents >= 0),
 status text not null default 'active' check (status in ('active','inactive')),
 external_id text unique,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- One row per check a teacher holds: a NSW or VIC Working with Children Check, a Queensland
-- blue card, a VIT registration (exempt in Victoria), or a New Zealand Children's Act safety check.
create table safety_checks (
 id uuid primary key default gen_random_uuid(),
 teacher_id uuid not null references teachers on delete cascade,
 jurisdiction text not null check (jurisdiction in ('NSW','VIC','QLD','WA','SA','TAS','ACT','NT','NZ')),
 kind text not null check (kind in ('wwcc','blue-card','exemption-card','vit-registration','nz-safety-check','other')),
 number text not null default '',
 issued_on date,
 expires_on date,
 verified_on date,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check (expires_on is null or issued_on is null or expires_on >= issued_on)
);

-- The customer: a family paying for children, or an adult paying for themselves.
create table families (
 id uuid primary key default gen_random_uuid(),
 name text not null unique,
 contact_name text,
 email text,
 phone text,
 payment_terms_days integer not null default 14 check (payment_terms_days between 0 and 120),
 status text not null default 'active' check (status in ('active','inactive','lead')),
 external_id text unique,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- adult = true for a student aged 18 or over (no child safety check needed to teach them).
create table students (
 id uuid primary key default gen_random_uuid(),
 family_id uuid not null references families,
 name text not null,
 dob date,
 adult boolean not null default false,
 school text not null default '',
 year_level text not null default '',
 status text not null default 'active' check (status in ('active','inactive','waitlist')),
 goals text not null default '',
 external_id text unique,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique (family_id, name)
);

create table lessons (
 id uuid primary key default gen_random_uuid(),
 service_id uuid not null references services,
 teacher_id uuid not null references teachers,
 location_id uuid not null references locations,
 starts_at timestamp not null,
 minutes integer not null check (minutes between 5 and 600),
 status text not null default 'scheduled' check (status in ('scheduled','completed','cancelled')),
 cancelled_by text check (cancelled_by in ('teacher','centre','weather')),
 notes text not null default '',
 external_id text unique,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index lessons_starts_at on lessons (starts_at);

-- Payment for a block of hours up front. Lessons draw minutes from it in date order.
create table packages (
 id uuid primary key default gen_random_uuid(),
 family_id uuid not null references families,
 student_id uuid references students,
 name text not null,
 minutes_purchased integer not null check (minutes_purchased > 0),
 price_cents integer not null check (price_cents >= 0),
 currency text not null default 'AUD' check (currency ~ '^[A-Z]{3}$'),
 purchased_on date not null default current_date,
 expires_on date,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- A make-up credit, issued when a student misses with notice. It is used by booking the
-- student into another lesson, and runs out on expires_on.
create table makeups (
 id uuid primary key default gen_random_uuid(),
 student_id uuid not null references students,
 issued_on date not null default current_date,
 expires_on date not null,
 reason text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- One row per student per lesson: attendance and what it costs.
-- attendance: present, late, absent-notice (make-up issued, no charge), absent-no-notice (charged),
-- or null while not yet marked. charge_cents is set when the lesson is marked.
-- billed_externally marks history imported from Teachworks that was already invoiced there.
create table lesson_students (
 id uuid primary key default gen_random_uuid(),
 lesson_id uuid not null references lessons on delete cascade,
 student_id uuid not null references students,
 attendance text check (attendance in ('present','late','absent-notice','absent-no-notice')),
 charge_cents integer check (charge_cents >= 0),
 package_id uuid references packages,
 makeup_id uuid unique references makeups,
 issued_makeup_id uuid unique references makeups,
 lesson_note text not null default '',
 billed_externally boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique (lesson_id, student_id)
);

create table invoices (
 id uuid primary key default gen_random_uuid(),
 family_id uuid not null references families,
 number text not null unique,
 currency text not null default 'AUD' check (currency ~ '^[A-Z]{3}$'),
 issued_on date not null default current_date,
 due_on date not null,
 status text not null default 'issued' check (status in ('draft','issued','void')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check (due_on >= issued_on)
);

create table invoice_lines (
 id uuid primary key default gen_random_uuid(),
 invoice_id uuid not null references invoices on delete cascade,
 description text not null,
 amount_cents integer not null,
 lesson_student_id uuid unique references lesson_students,
 package_id uuid unique references packages,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table payments (
 id uuid primary key default gen_random_uuid(),
 family_id uuid not null references families,
 invoice_id uuid references invoices,
 paid_on date not null default current_date,
 amount_cents integer not null check (amount_cents > 0),
 method text not null default 'bank transfer',
 reference text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table notes (
 id uuid primary key default gen_random_uuid(),
 family_id uuid references families,
 student_id uuid references students,
 teacher_id uuid references teachers,
 kind text not null default 'note' check (kind in ('note','call','email','progress','complaint')),
 title text not null default 'Note',
 body text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check (family_id is not null or student_id is not null or teacher_id is not null)
);

do $$ declare t text; begin
 foreach t in array array['locations','services','teachers','safety_checks','families','students','lessons','packages','makeups','lesson_students','invoices','invoice_lines','payments','notes'] loop
  execute format('create trigger %I before update on %I for each row execute function touch_updated_at()', t || '_touch', t);
 end loop;
end $$;

-- Every student in every lesson, with the facts the weekly jobs need beside it.
-- chargeable: present, late, or absent without notice, in a lesson that went ahead.
-- minor: not marked adult and under 18 on the lesson date (no date of birth counts as a child).
create view v_roster as
select ls.id, ls.lesson_id, ls.student_id, s.family_id, l.teacher_id, l.service_id, l.location_id,
 l.starts_at, l.starts_at::date as on_date, l.minutes, l.status as lesson_status,
 s.name as student, f.name as family, t.name as teacher, sv.name as service, lo.name as location,
 lo.jurisdiction, lo.currency, ls.attendance, ls.charge_cents, ls.package_id, ls.makeup_id, ls.lesson_note,
 (l.status <> 'cancelled' and ls.attendance in ('present','late','absent-no-notice')) as chargeable,
 (not s.adult and (s.dob is null or s.dob > (l.starts_at::date - interval '18 years')::date)) as minor,
 (ls.billed_externally or exists (select 1 from invoice_lines il where il.lesson_student_id = ls.id)) as invoiced
from lesson_students ls
join lessons l on l.id = ls.lesson_id
join students s on s.id = ls.student_id
join families f on f.id = s.family_id
join teachers t on t.id = l.teacher_id
join services sv on sv.id = l.service_id
join locations lo on lo.id = l.location_id;

create view v_package_balance as
select p.id, p.family_id, p.student_id, f.name as family, s.name as student, p.name, p.currency, p.price_cents,
 p.minutes_purchased, p.purchased_on, p.expires_on,
 coalesce(sum(r.minutes) filter (where r.chargeable), 0)::int as minutes_used,
 (p.minutes_purchased - coalesce(sum(r.minutes) filter (where r.chargeable), 0))::int as minutes_left,
 (select coalesce(sum(b.minutes), 0) from v_roster b where b.student_id = p.student_id and b.lesson_status = 'scheduled'
  and b.on_date >= current_date and b.makeup_id is null)::int as minutes_booked
from packages p
join families f on f.id = p.family_id
left join students s on s.id = p.student_id
left join v_roster r on r.package_id = p.id
group by p.id, f.name, s.name;

create view v_invoices as
select i.id, i.family_id, f.name as family, i.number, i.currency, i.issued_on, i.due_on, i.status,
 coalesce((select sum(amount_cents) from invoice_lines il where il.invoice_id = i.id), 0)::int as amount_cents,
 coalesce((select sum(amount_cents) from payments p where p.invoice_id = i.id), 0)::int as paid_cents,
 (coalesce((select sum(amount_cents) from invoice_lines il where il.invoice_id = i.id), 0)
  - coalesce((select sum(amount_cents) from payments p where p.invoice_id = i.id), 0))::int as balance_cents,
 greatest(current_date - i.due_on, 0) as days_overdue
from invoices i join families f on f.id = i.family_id
where i.status = 'issued';

create view v_family_balance as
select f.id, f.name as family, f.contact_name, f.email, v.currency,
 sum(v.amount_cents)::int as invoiced_cents, sum(v.paid_cents)::int as paid_cents, sum(v.balance_cents)::int as balance_cents,
 coalesce(sum(v.balance_cents) filter (where v.due_on < current_date), 0)::int as overdue_cents,
 min(v.due_on) filter (where v.due_on < current_date and v.balance_cents > 0) as oldest_overdue
from families f join v_invoices v on v.family_id = f.id
group by f.id, f.name, f.contact_name, f.email, v.currency;

-- Lessons that were taught and charged but are on no invoice and no package.
create view v_unbilled as
select r.id, r.family_id, r.family, r.student, r.service, r.teacher, r.on_date, r.minutes, r.currency, r.charge_cents,
 current_date - r.on_date as days_since
from v_roster r
where r.chargeable and r.package_id is null and not r.invoiced and coalesce(r.charge_cents, 0) > 0;

-- Each active student's recent rhythm: what they came to, what they missed, what is booked.
create view v_student_activity as
select s.id, s.name as student, f.name as family, s.status,
 count(*) filter (where r.attendance in ('present','late') and r.on_date >= current_date - 21)::int as attended_3wk,
 count(*) filter (where r.attendance in ('present','late') and r.on_date >= current_date - 42 and r.on_date < current_date - 21)::int as attended_prior_3wk,
 count(*) filter (where r.attendance like 'absent%' and r.on_date >= current_date - 28)::int as absences_28d,
 max(r.on_date) filter (where r.attendance in ('present','late')) as last_attended,
 min(r.on_date) filter (where r.lesson_status = 'scheduled' and r.on_date >= current_date) as next_booked
from students s join families f on f.id = s.family_id
left join v_roster r on r.student_id = s.id and r.lesson_status <> 'cancelled'
group by s.id, s.name, f.name, s.status;

create view v_makeups as
select m.id, m.student_id, s.name as student, f.name as family, m.issued_on, m.expires_on, m.reason,
 ls.id as used_by, case when ls.id is not null then 'booked' when m.expires_on < current_date then 'expired' else 'available' end as state,
 m.expires_on - current_date as days_left
from makeups m join students s on s.id = m.student_id join families f on f.id = s.family_id
left join lesson_students ls on ls.makeup_id = m.id;

-- The check a teacher needs where the lesson happens, valid on the lesson date.
create view v_safety_gaps as
select r.lesson_id, r.teacher_id, r.teacher, r.location, r.jurisdiction, r.on_date, r.student,
 (select c.kind from safety_checks c where c.teacher_id = r.teacher_id and c.jurisdiction = r.jurisdiction order by c.expires_on desc nulls first limit 1) as held,
 (select max(c.expires_on) from safety_checks c where c.teacher_id = r.teacher_id and c.jurisdiction = r.jurisdiction) as expired_on
from v_roster r
where r.minor and r.jurisdiction is not null and r.lesson_status <> 'cancelled'
 and r.on_date between current_date - 90 and current_date + 14
 and not exists (
  select 1 from safety_checks c where c.teacher_id = r.teacher_id and c.jurisdiction = r.jurisdiction
   and c.kind <> 'other' and (c.issued_on is null or c.issued_on <= r.on_date) and (c.expires_on is null or c.expires_on >= r.on_date));

create view v_compliance as
select 'SAFETY-NO-CHECK' as rule, g.teacher as subject,
 count(distinct g.lesson_id)::int || ' lesson(s) with children at ' || string_agg(distinct g.location, ', ') || ' from ' || min(g.on_date) || ' with no current '
  || case g.jurisdiction when 'QLD' then 'blue card' when 'NZ' then 'safety check' else 'Working with Children Check' end
  || coalesce(' (held one that expired ' || max(g.expired_on) || ')', '') as finding,
 min(g.on_date) as since,
 case g.jurisdiction
  when 'QLD' then 'Working with Children (Risk Management and Screening) Act 2000 (Qld), private teaching, coaching or tutoring: https://www.qld.gov.au/law/laws-regulated-industries-and-accountability/queensland-laws-and-regulations/regulated-industries-and-licensing/blue-card/required/individuals-businesses/private-teaching-coaching-tutoring'
  when 'NSW' then 'Child Protection (Working with Children) Act 2012 (NSW); Office of the Children''s Guardian: https://ocg.nsw.gov.au/working-children-check'
  when 'VIC' then 'Worker Screening Act 2020 (Vic): https://www.legislation.vic.gov.au/in-force/acts/worker-screening-act-2020'
  when 'NZ' then 'Children''s Act 2014 (NZ), Part 3 safety checks: https://www.legislation.govt.nz/act/public/2014/0040/latest/whole.html'
  else 'The working with children law of ' || g.jurisdiction || '; see docs/compliance.md' end as source
from v_safety_gaps g group by g.teacher, g.jurisdiction
union all
select 'AU-NSW-WWCC-VERIFY', t.name, 'NSW Working with Children Check ' || c.number || ' not verified by the employer', c.issued_on,
 'Office of the Children''s Guardian, employer obligations: https://ocg.nsw.gov.au/working-children-check/organisation'
from safety_checks c join teachers t on t.id = c.teacher_id
where c.jurisdiction = 'NSW' and c.kind = 'wwcc' and c.verified_on is null and t.status = 'active'
union all
select 'NZ-SAFETY-RECHECK', t.name, 'Safety check last done ' || coalesce(c.verified_on, c.issued_on) || ', more than three years ago', coalesce(c.verified_on, c.issued_on),
 'Children''s (Requirements for Safety Checks of Children''s Workers) Regulations 2015 (NZ), periodic rechecks every three years; Te Kahui Kahu: https://www.tekahuikahu.govt.nz/resources/vetting'
from safety_checks c join teachers t on t.id = c.teacher_id
where c.jurisdiction = 'NZ' and c.kind = 'nz-safety-check' and t.status = 'active'
 and coalesce(c.verified_on, c.issued_on) < current_date - interval '3 years'
 and not exists (select 1 from safety_checks c2 where c2.teacher_id = c.teacher_id and c2.jurisdiction = 'NZ' and c2.kind = 'nz-safety-check' and coalesce(c2.verified_on, c2.issued_on) >= current_date - interval '3 years')
union all
select 'SAFETY-EXPIRING', t.name, c.kind || ' (' || c.jurisdiction || ') expires ' || c.expires_on || ', in ' || (c.expires_on - current_date) || ' days', c.expires_on,
 'Renew before expiry so the teacher can keep teaching children; see docs/compliance.md'
from safety_checks c join teachers t on t.id = c.teacher_id
where t.status = 'active' and c.expires_on between current_date and current_date + 60
union all
select 'POLICY-UNMARKED', r.teacher, count(*)::int || ' past student-lesson(s) with no attendance, oldest ' || min(r.on_date), min(r.on_date),
 'Centre policy: mark attendance by the end of the next day. Billing, packages and make-ups all read it.'
from v_roster r where r.attendance is null and r.lesson_status <> 'cancelled' and r.on_date < current_date
group by r.teacher
union all
select 'POLICY-UNBILLED', u.family, count(*)::int || ' charged lesson(s) more than 31 days old on no invoice or package', min(u.on_date),
 'Centre policy: every charged lesson is invoiced in the next monthly billing run.'
from v_unbilled u where u.days_since > 31 group by u.family
union all
select 'POLICY-PACKAGE-OVERDRAWN', p.family, p.name || ': ' || (-p.minutes_left) || ' minutes taught beyond what was paid for', p.purchased_on,
 'Centre policy: sell the next package before the current one runs out.'
from v_package_balance p where p.minutes_left < 0
union all
select 'POLICY-DOUBLE-BOOKED', t.name, 'Two lessons overlap on ' || a.starts_at::date || ' at ' || to_char(a.starts_at, 'HH24:MI') || ' and ' || to_char(b.starts_at, 'HH24:MI'), a.starts_at::date,
 'Centre policy: one teacher, one lesson at a time.'
from lessons a join lessons b on b.teacher_id = a.teacher_id and b.id > a.id
 and b.starts_at < a.starts_at + make_interval(mins => a.minutes) and a.starts_at < b.starts_at + make_interval(mins => b.minutes)
join teachers t on t.id = a.teacher_id
where a.status <> 'cancelled' and b.status <> 'cancelled' and a.starts_at >= current_date - 7
union all
select 'POLICY-INVOICE-OVERDUE', family, number || ': ' || currency || ' ' || to_char(balance_cents / 100.0, 'FM999999990.00') || ' unpaid, ' || days_overdue || ' days past due', due_on,
 'Centre policy and the terms on the invoice.'
from v_invoices where balance_cents > 0 and due_on < current_date;
