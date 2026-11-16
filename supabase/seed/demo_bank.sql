-- Draftly — load the demo block bank into one real account.
--
-- Adds the 17 demo bank entries (the demo resume's roles, projects,
-- education, skill groups and summary, plus extra roles and projects that are
-- not on it) to the block bank of the account with the email below, so
-- "Build tailored resume" has something to pick from on the live site.
--
-- How to run: Supabase dashboard → SQL Editor → New query → paste this file,
-- replace YOUR_EMAIL_HERE with the email you sign in with, and click Run.
--
-- Safe to re-run: an entry already in that account's bank is skipped.
-- To undo: delete from public.saved_blocks where user_id = (select id from
-- auth.users where email = 'YOUR_EMAIL_HERE') and 'demo' = any(tags);
--
-- The SQL editor runs as the database owner, so row-level security does not
-- apply here and user_id has to be set explicitly.

with me as (
  select id from auth.users where email = 'YOUR_EMAIL_HERE'
),
entries (name, tags, block) as (
  values
  ('Summary', array['summary']::text[], '{"type":"summary","label":"Summary","enabled":true,"data":{"text":"Computer science student with internship experience building web applications end to end. Comfortable across the stack, from Postgres schemas to React interfaces, and happiest shipping features other people actually use."}}'::jsonb),
  ('Software Engineering Intern · Northbridge Labs', array['experience']::text[], '{"type":"experience","label":"Experience","enabled":true,"data":{"items":[{"role":"Software Engineering Intern","org":"Northbridge Labs","dates":"Summer 2025","points":["Built a job-application tracker feature used by 400+ beta users, cutting manual status updates by 60%.","Wrote the REST endpoints and Postgres schema behind it, plus the React front end.","Added integration tests that caught three regressions before release."]}]}}'::jsonb),
  ('Web Developer (Part-time) · University IT Office', array['experience']::text[], '{"type":"experience","label":"Experience","enabled":true,"data":{"items":[{"role":"Web Developer (Part-time)","org":"University IT Office","dates":"2024 – Present","points":["Maintain the university''s public site in a CMS with hand-written HTML, CSS, and JavaScript.","Fixed 20+ accessibility issues to meet WCAG AA, improving audit scores across key pages."]}]}}'::jsonb),
  ('Languages', array['skills']::text[], '{"type":"skills","label":"Skills","enabled":true,"data":{"groups":[{"name":"Languages","items":"TypeScript, Python, Java, SQL"}]}}'::jsonb),
  ('Frameworks', array['skills']::text[], '{"type":"skills","label":"Skills","enabled":true,"data":{"groups":[{"name":"Frameworks","items":"React, FastAPI, Spring Boot"}]}}'::jsonb),
  ('Tools', array['skills']::text[], '{"type":"skills","label":"Skills","enabled":true,"data":{"groups":[{"name":"Tools","items":"Git, Docker, Supabase, Postgres"}]}}'::jsonb),
  ('B.S. Computer Science · University of Texas at Arlington', array['education']::text[], '{"type":"education","label":"Education","enabled":true,"data":{"items":[{"school":"University of Texas at Arlington","degree":"B.S. Computer Science","dates":"Expected May 2027","detail":"Relevant coursework: Software Engineering, Databases, Computer Networks."}]}}'::jsonb),
  ('Draftly', array['projects']::text[], '{"type":"projects","label":"Projects","enabled":true,"data":{"items":[{"name":"Draftly","detail":"Block-based resume editor with drag-and-drop sections and application tracking. React, TypeScript, Supabase.","url":"github.com/jachen/draftly"}]}}'::jsonb),
  ('Data Analyst Intern · Lone Star Health', array['experience']::text[], '{"type":"experience","label":"Experience","enabled":true,"data":{"items":[{"role":"Data Analyst Intern","org":"Lone Star Health","dates":"Summer 2024","points":["Built Tableau dashboards on SQL and Python (pandas) pipelines that tracked clinic wait times across 12 sites.","Automated a weekly Excel report with Python, saving the operations team about 5 hours a week."]}]}}'::jsonb),
  ('Teaching Assistant, Data Structures · University of Texas at Arlington', array['experience']::text[], '{"type":"experience","label":"Experience","enabled":true,"data":{"items":[{"role":"Teaching Assistant, Data Structures","org":"University of Texas at Arlington","dates":"Fall 2024 – Spring 2025","points":["Led weekly Java lab sessions for 40 students on trees, graphs and hashing.","Wrote JUnit autograder tests that cut grading time per assignment by half."]}]}}'::jsonb),
  ('Mobile Developer Intern · Pixel Kite Studio', array['experience']::text[], '{"type":"experience","label":"Experience","enabled":true,"data":{"items":[{"role":"Mobile Developer Intern","org":"Pixel Kite Studio","dates":"Spring 2024","points":["Shipped two React Native screens for an iOS and Android fitness app with a Firebase back end.","Fixed crash reports from Sentry, lowering the crash rate from 2.1% to 0.4%."]}]}}'::jsonb),
  ('Kubernetes Homelab', array['projects']::text[], '{"type":"projects","label":"Projects","enabled":true,"data":{"items":[{"name":"Kubernetes Homelab","detail":"Three-node cluster running Docker services, provisioned with Terraform on AWS and deployed by a GitHub Actions CI/CD pipeline."}]}}'::jsonb),
  ('Review Sentiment Analyzer', array['projects']::text[], '{"type":"projects","label":"Projects","enabled":true,"data":{"items":[{"name":"Review Sentiment Analyzer","detail":"Python and PyTorch NLP model served through a FastAPI endpoint; 89% accuracy on 50k product reviews."}]}}'::jsonb),
  ('Campus Ride Share', array['projects']::text[], '{"type":"projects","label":"Projects","enabled":true,"data":{"items":[{"name":"Campus Ride Share","detail":"React Native app with Firebase auth and the Google Maps API, used by 150 students during a pilot semester."}]}}'::jsonb),
  ('Cloud & DevOps', array['skills']::text[], '{"type":"skills","label":"Skills","enabled":true,"data":{"groups":[{"name":"Cloud & DevOps","items":"AWS, Kubernetes, Terraform, GitHub Actions, Linux"}]}}'::jsonb),
  ('Data', array['skills']::text[], '{"type":"skills","label":"Skills","enabled":true,"data":{"groups":[{"name":"Data","items":"pandas, NumPy, PyTorch, Tableau, Excel"}]}}'::jsonb),
  ('Mobile', array['skills']::text[], '{"type":"skills","label":"Skills","enabled":true,"data":{"groups":[{"name":"Mobile","items":"React Native, Swift, Firebase"}]}}'::jsonb)
)
insert into public.saved_blocks (user_id, name, tags, block)
select me.id, e.name, e.tags || array['demo'], e.block
from me cross join entries e
where not exists (
  select 1 from public.saved_blocks s
  where s.user_id = me.id and s.block = e.block
)
returning name;
