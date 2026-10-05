-- Harbour Tutoring Group (demo): fictional families, students and teachers across Chatswood (NSW),
-- Indooroopilly (QLD), Takapuna (NZ) and online. Dates are relative to the day the seed runs.
-- Idempotent: fixed or derived ids, and every insert skips rows that already exist. Money is in cents.
-- Deliberate problems to find: an expired blue card, an unverified NSW check, a New Zealand
-- recheck overdue, unmarked attendance, an overdrawn package, an unbilled lesson, overdue
-- invoices, a double booking next week and a student who has stopped booking.
begin;

insert into locations (id,name,jurisdiction,currency,address,online) values
 ('10000000-0000-4000-8000-000000000001','Chatswood','NSW','AUD','Level 2, 12 Victoria Ave, Chatswood NSW',false),
 ('10000000-0000-4000-8000-000000000002','Indooroopilly','QLD','AUD','Shop 4, 30 Station Rd, Indooroopilly QLD',false),
 ('10000000-0000-4000-8000-000000000003','Takapuna','NZ','NZD','1/50 Hurstmere Rd, Takapuna, Auckland',false),
 ('10000000-0000-4000-8000-000000000004','Online (Sydney)','NSW','AUD','Video call, taught from Sydney',true)
on conflict do nothing;

insert into services (id,name,subject,rate_cents,max_students) values
 ('20000000-0000-4000-8000-000000000001','Primary Maths 1:1','Maths',7000,1),
 ('20000000-0000-4000-8000-000000000002','Senior Maths 1:1','Maths',9000,1),
 ('20000000-0000-4000-8000-000000000003','English Writing Group','English',4500,4),
 ('20000000-0000-4000-8000-000000000004','Piano','Music',9000,1),
 ('20000000-0000-4000-8000-000000000005','Adult IELTS Prep','English',8000,1),
 ('20000000-0000-4000-8000-000000000006','Selective Exam Group','Selective',5000,6)
on conflict do nothing;

insert into teachers (id,name,email,phone,pay_rate_cents) values
 ('30000000-0000-4000-8000-000000000001','Aroha Ngata','aroha@harbour-tutoring.test','021 555 0101',4000),
 ('30000000-0000-4000-8000-000000000002','Ben Carter','ben@harbour-tutoring.test','0400 555 102',4500),
 ('30000000-0000-4000-8000-000000000003','Chloe Nguyen','chloe@harbour-tutoring.test','0400 555 103',4200),
 ('30000000-0000-4000-8000-000000000004','Daniel Okafor','daniel@harbour-tutoring.test','0400 555 104',4000),
 ('30000000-0000-4000-8000-000000000005','Emma Walsh','emma@harbour-tutoring.test','0400 555 105',4200),
 ('30000000-0000-4000-8000-000000000006','Liam Patel','liam@harbour-tutoring.test','0400 555 106',4500)
on conflict do nothing;

insert into safety_checks (id,teacher_id,jurisdiction,kind,number,issued_on,expires_on,verified_on) values
 ('31000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','NZ','nz-safety-check','HTG-SC-2022-07',current_date-1300,null,current_date-1300),
 ('31000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002','NSW','wwcc','WWC0012345E',current_date-700,current_date+1100,current_date-690),
 ('31000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000003','NSW','wwcc','WWC0023456E',current_date-200,current_date+1600,null),
 ('31000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000004','QLD','blue-card','1234567/2',current_date-1105,current_date-10,current_date-1100),
 ('31000000-0000-4000-8000-000000000005','30000000-0000-4000-8000-000000000005','QLD','blue-card','2345678/1',current_date-1065,current_date+30,current_date-1060),
 ('31000000-0000-4000-8000-000000000006','30000000-0000-4000-8000-000000000006','NSW','wwcc','WWC0034567E',current_date-400,current_date+1400,current_date-395)
on conflict do nothing;

insert into families (id,name,contact_name,email,phone,status) values
 ('40000000-0000-4000-8000-000000000001','Chen family','Grace Chen','grace.chen@example.test','0411 555 201','active'),
 ('40000000-0000-4000-8000-000000000002','Wilson family','Mark Wilson','mark.wilson@example.test','0411 555 202','active'),
 ('40000000-0000-4000-8000-000000000003','Patel-Singh family','Anita Patel-Singh','anita.ps@example.test','0411 555 203','active'),
 ('40000000-0000-4000-8000-000000000004','Haddad family','Rana Haddad','rana.haddad@example.test','0411 555 204','active'),
 ('40000000-0000-4000-8000-000000000005','O''Brien family','Kate O''Brien','kate.obrien@example.test','0411 555 205','active'),
 ('40000000-0000-4000-8000-000000000006','Kowalski family','Piotr Kowalski','piotr.k@example.test','0411 555 206','active'),
 ('40000000-0000-4000-8000-000000000007','Morgan family','Sarah Morgan','sarah.morgan@example.test','0411 555 207','active'),
 ('40000000-0000-4000-8000-000000000008','Tane whanau','Hemi Tane','hemi.tane@example.test','021 555 208','active'),
 ('40000000-0000-4000-8000-000000000009','Walker family','Jo Walker','jo.walker@example.test','021 555 209','active'),
 ('40000000-0000-4000-8000-000000000010','Sofia Rossi','Sofia Rossi','sofia.rossi@example.test','0411 555 210','active'),
 ('40000000-0000-4000-8000-000000000011','Kim family','Min-ji Kim','minji.kim@example.test','0411 555 211','active'),
 ('40000000-0000-4000-8000-000000000012','Nguyen family','Tran Nguyen','tran.nguyen@example.test','0411 555 212','lead')
on conflict do nothing;

insert into students (id,family_id,name,dob,adult,school,year_level,status,goals) values
 ('50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','Olivia Chen',current_date-3900,false,'Chatswood Public','Year 5','active','Times tables to 12 by end of term'),
 ('50000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001','Lucas Chen',current_date-4950,false,'Chatswood High','Year 8','active','Paragraph structure in persuasive writing'),
 ('50000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000002','Ruby Wilson',current_date-6250,false,'North Sydney Girls','Year 12','active','Band 6 in Mathematics Advanced'),
 ('50000000-0000-4000-8000-000000000004','40000000-0000-4000-8000-000000000003','Arjun Patel-Singh',current_date-4100,false,'Artarmon Public','Year 6','active','Selective test in March'),
 ('50000000-0000-4000-8000-000000000005','40000000-0000-4000-8000-000000000004','Zara Haddad',current_date-3950,false,'Willoughby Public','Year 5','active','Confidence with fractions and writing'),
 ('50000000-0000-4000-8000-000000000006','40000000-0000-4000-8000-000000000005','Finn O''Brien',current_date-5300,false,'Indooroopilly State High','Year 9','active','Pass Year 9 algebra'),
 ('50000000-0000-4000-8000-000000000007','40000000-0000-4000-8000-000000000006','Maya Kowalski',current_date-3500,false,'Ironside State School','Year 4','active','AMEB Grade 2 piano'),
 ('50000000-0000-4000-8000-000000000008','40000000-0000-4000-8000-000000000007','Isla Morgan',current_date-4600,false,'Kenmore State High','Year 7','active','Catch up on number skills'),
 ('50000000-0000-4000-8000-000000000009','40000000-0000-4000-8000-000000000008','Nikau Tane',current_date-4050,false,'Takapuna Primary','Year 6','active','Ready for intermediate maths'),
 ('50000000-0000-4000-8000-000000000010','40000000-0000-4000-8000-000000000009','Ella Walker',current_date-5450,false,'Westlake Girls','Year 10','active','Merit in NCEA Level 1 numeracy'),
 ('50000000-0000-4000-8000-000000000011','40000000-0000-4000-8000-000000000010','Sofia Rossi',current_date-10950,true,'','Adult','active','IELTS 7.0 for a nursing registration'),
 ('50000000-0000-4000-8000-000000000012','40000000-0000-4000-8000-000000000011','Jae Kim',current_date-4150,false,'Lane Cove Public','Year 6','active','Selective test in March'),
 ('50000000-0000-4000-8000-000000000013','40000000-0000-4000-8000-000000000012','Mia Nguyen',current_date-3100,false,'Chatswood Public','Year 3','waitlist','Reading and writing')
on conflict do nothing;

-- Weekly slots. dow is 1 (Monday) to 6 (Saturday). Weeks run from first_week to last_week,
-- counted from this week (0). Each slot becomes one lesson a week with its students.
create temp table seed_slots (slot text, dow int, at time, minutes int, teacher uuid, service uuid, location uuid, students uuid[], first_week int, last_week int) on commit drop;
insert into seed_slots values
 ('A',1,'16:00',60,'30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',array['50000000-0000-4000-8000-000000000001']::uuid[],-6,2),
 ('B',1,'17:00',60,'30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001',array['50000000-0000-4000-8000-000000000003']::uuid[],-6,2),
 ('C',2,'16:30',60,'30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001',array['50000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000005']::uuid[],-6,2),
 ('D',3,'17:00',60,'30000000-0000-4000-8000-000000000006','20000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000004',array['50000000-0000-4000-8000-000000000004','50000000-0000-4000-8000-000000000012']::uuid[],-6,-3),
 ('D2',3,'17:00',60,'30000000-0000-4000-8000-000000000006','20000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000004',array['50000000-0000-4000-8000-000000000004']::uuid[],-2,2),
 ('E',4,'16:00',60,'30000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002',array['50000000-0000-4000-8000-000000000006']::uuid[],-6,2),
 ('F',4,'17:00',60,'30000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002',array['50000000-0000-4000-8000-000000000008']::uuid[],-6,2),
 ('G',6,'09:00',30,'30000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000002',array['50000000-0000-4000-8000-000000000007']::uuid[],-6,2),
 ('H',2,'15:30',60,'30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003',array['50000000-0000-4000-8000-000000000009']::uuid[],-6,2),
 ('I',2,'16:30',60,'30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003',array['50000000-0000-4000-8000-000000000010']::uuid[],-6,2),
 ('J',1,'19:00',60,'30000000-0000-4000-8000-000000000006','20000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000004',array['50000000-0000-4000-8000-000000000011']::uuid[],-6,2),
 ('K',3,'16:00',60,'30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',array['50000000-0000-4000-8000-000000000005']::uuid[],-6,2);

create temp table seed_lessons on commit drop as
select md5('lesson:'||s.slot||':'||w)::uuid as id, s.*, w,
 ((current_date - (extract(isodow from current_date)::int - 1)) + 7*w + (s.dow-1)) + s.at as starts_at
from seed_slots s, generate_series(-6,2) w where w between s.first_week and s.last_week;

insert into lessons (id,service_id,teacher_id,location_id,starts_at,minutes,status,cancelled_by)
select id,service,teacher,location,starts_at,minutes,
 case when slot='H' and w=-2 then 'cancelled' when starts_at::date<current_date and not (teacher='30000000-0000-4000-8000-000000000003' and starts_at::date>=current_date-7) then 'completed' else 'scheduled' end,
 case when slot='H' and w=-2 then 'teacher' end
from seed_lessons on conflict do nothing;

-- One-off lessons: an extra Maths lesson for Zara forty days ago that never made it onto an
-- invoice, and a booking next Monday that overlaps Ben's 4pm lesson.
insert into lessons (id,service_id,teacher_id,location_id,starts_at,minutes,status,notes) values
 ('60000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001',(current_date-40)+time '10:00',60,'completed','Holiday catch-up'),
 ('60000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001',(current_date-(extract(isodow from current_date)::int-1)+7)+time '16:15',30,'scheduled','Trial lesson')
on conflict do nothing;

create temp table seed_ls on commit drop as
select md5('ls:'||l.id||':'||st)::uuid as id, l.id as lesson_id, st as student_id, l.starts_at, l.minutes, l.service, l.teacher, l.slot, l.w,
 (('x'||substr(md5(l.id::text||st::text),1,7))::bit(28)::int % 20) as roll
from seed_lessons l, unnest(l.students) st;

insert into packages (id,family_id,student_id,name,minutes_purchased,price_cents,currency,purchased_on,expires_on) values
 ('70000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000003','50000000-0000-4000-8000-000000000004','Selective term block, 7 hours',420,31500,'AUD',current_date-48,current_date+60),
 ('70000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000006','50000000-0000-4000-8000-000000000007','Piano, four 30 minute lessons',120,18000,'AUD',current_date-48,current_date+90),
 ('70000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000010','50000000-0000-4000-8000-000000000011','IELTS block, 10 hours',600,80000,'AUD',current_date-45,current_date+120)
on conflict do nothing;

insert into lesson_students (id,lesson_id,student_id,attendance,charge_cents,package_id)
select x.id, x.lesson_id, x.student_id, x.attendance,
 case when x.attendance in ('present','late','absent-no-notice') then (sv.rate_cents * x.minutes / 60) end,
 case when x.attendance in ('present','late','absent-no-notice') then (select p.id from packages p where p.student_id = x.student_id) end
from (
 select ls.*, case
  when ls.starts_at::date >= current_date then null
  when ls.slot='H' and ls.w=-2 then null
  when ls.teacher='30000000-0000-4000-8000-000000000003' and ls.starts_at::date>=current_date-7 then null
  when ls.student_id='50000000-0000-4000-8000-000000000006' and ls.w in (-2,-1) then 'absent-no-notice'
  when ls.roll in (0,1) then 'absent-notice'
  when ls.roll = 2 then 'absent-no-notice'
  when ls.roll = 3 then 'late'
  else 'present' end as attendance
 from seed_ls ls
) x join services sv on sv.id = x.service
on conflict do nothing;

insert into lesson_students (id,lesson_id,student_id,attendance,charge_cents,lesson_note) values
 ('61000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000005','present',7000,'Fractions on a number line'),
 ('61000000-0000-4000-8000-000000000002','60000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000002',null,null,'')
on conflict do nothing;

-- A make-up credit for every absence with notice, valid for six weeks.
insert into makeups (id,student_id,issued_on,expires_on,reason)
select md5('makeup:'||ls.id)::uuid, ls.student_id, l.starts_at::date, l.starts_at::date+42, 'Absent with notice'
from lesson_students ls join lessons l on l.id=ls.lesson_id
where ls.attendance='absent-notice'
on conflict do nothing;
update lesson_students ls set issued_makeup_id = md5('makeup:'||ls.id)::uuid
where ls.attendance='absent-notice' and ls.issued_makeup_id is null and exists (select 1 from makeups m where m.id = md5('makeup:'||ls.id)::uuid);

-- Last month's billing run, 20 days ago: one invoice per family for every charged lesson
-- before then that is not on a package. Zara's holiday lesson was missed.
insert into invoices (id,family_id,number,currency,issued_on,due_on)
select md5('inv:'||f.id)::uuid, f.id, 'INV-' || (1000 + row_number() over (order by f.name)), min(r.currency), current_date-20, current_date-6
from families f join v_roster r on r.family_id=f.id
where r.chargeable and r.package_id is null and r.on_date < current_date-21 and r.id <> '61000000-0000-4000-8000-000000000001'
group by f.id, f.name
on conflict do nothing;
insert into invoice_lines (id,invoice_id,description,amount_cents,lesson_student_id)
select md5('line:'||r.id)::uuid, md5('inv:'||r.family_id)::uuid, r.service || ', ' || r.student || ', ' || r.on_date, r.charge_cents, r.id
from v_roster r
where r.chargeable and r.package_id is null and r.on_date < current_date-21 and r.id <> '61000000-0000-4000-8000-000000000001'
 and exists (select 1 from invoices i where i.id = md5('inv:'||r.family_id)::uuid and i.issued_on = current_date-20)
on conflict do nothing;

-- Packages are invoiced when sold and were paid up front.
insert into invoices (id,family_id,number,currency,issued_on,due_on) values
 ('71000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000003','INV-0901','AUD',current_date-48,current_date-41),
 ('71000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000006','INV-0902','AUD',current_date-48,current_date-41),
 ('71000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000010','INV-0903','AUD',current_date-45,current_date-38)
on conflict do nothing;
insert into invoice_lines (id,invoice_id,description,amount_cents,package_id) values
 ('72000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001','Selective term block, 7 hours',31500,'70000000-0000-4000-8000-000000000001'),
 ('72000000-0000-4000-8000-000000000002','71000000-0000-4000-8000-000000000002','Piano, four 30 minute lessons',18000,'70000000-0000-4000-8000-000000000002'),
 ('72000000-0000-4000-8000-000000000003','71000000-0000-4000-8000-000000000003','IELTS block, 10 hours',80000,'70000000-0000-4000-8000-000000000003')
on conflict do nothing;

-- Everyone paid except the Wilsons (nothing yet) and the Walkers (half).
insert into payments (id,family_id,invoice_id,paid_on,amount_cents,method,reference)
select md5('pay:'||v.id)::uuid, v.family_id, v.id, v.issued_on + 5,
 case when v.family = 'Walker family' then v.amount_cents / 2 else v.amount_cents end,
 'bank transfer', 'Ref ' || v.number
from v_invoices v
where v.family <> 'Wilson family' and v.amount_cents > 0
on conflict do nothing;

insert into notes (id,family_id,student_id,teacher_id,kind,title,body,created_at) values
 ('80000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','progress','Term progress','Olivia knows her tables to 9 and is working on 11 and 12. Word problems are the next step.',now()-interval '9 days'),
 ('80000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002',null,null,'call','Invoice query','Mark asked for the invoice to be resent to his work email. Resent, he said he would pay that week.',now()-interval '12 days'),
 ('80000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000011','50000000-0000-4000-8000-000000000012',null,'call','Pausing lessons','Min-ji said Jae is pausing for a few weeks during sport season. Follow up before the selective mock exam.',now()-interval '20 days'),
 ('80000000-0000-4000-8000-000000000004','40000000-0000-4000-8000-000000000005','50000000-0000-4000-8000-000000000006','30000000-0000-4000-8000-000000000004','progress','Algebra','Finn is solving two-step equations on his own. Missed the last two lessons without notice.',now()-interval '6 days'),
 ('80000000-0000-4000-8000-000000000005','40000000-0000-4000-8000-000000000012','50000000-0000-4000-8000-000000000013',null,'email','Waitlist','Tran asked for a Tuesday writing group place for Mia. Group has two of four places taken.',now()-interval '15 days')
on conflict do nothing;

commit;
