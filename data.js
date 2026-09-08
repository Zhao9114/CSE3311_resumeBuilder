// ---- Dummy data for the demo. No backend, no network. ----

const PROFILE = {
  name: "Jordan Avery Chen",
  title: "Software Engineer",
  email: "jordan.chen@email.com",
  phone: "(214) 555-0182",
  location: "Arlington, TX",
  links: "github.com/jachen · linkedin.com/in/jachen",
};

// Each block: { id, type, label, enabled, data }
// Block order in this array is the render order — drag-and-drop reorders it.
let BLOCKS = [
  {
    id: "b1",
    type: "summary",
    label: "Summary",
    enabled: true,
    data: {
      text: "Computer science student with internship experience building web applications end to end. Comfortable across the stack, from Postgres schemas to React interfaces, and happiest shipping features other people actually use.",
    },
  },
  {
    id: "b2",
    type: "experience",
    label: "Experience",
    enabled: true,
    data: {
      items: [
        {
          role: "Software Engineering Intern",
          org: "Northbridge Labs",
          dates: "Summer 2025",
          points: [
            "Built a job-application tracker feature used by 400+ beta users, cutting manual status updates by 60%.",
            "Wrote the REST endpoints and Postgres schema behind it, plus the React front end.",
            "Added integration tests that caught three regressions before release.",
          ],
        },
        {
          role: "Web Developer (Part-time)",
          org: "University IT Office",
          dates: "2024 – Present",
          points: [
            "Maintain the university's public site in a CMS with hand-written HTML, CSS, and JavaScript.",
            "Fixed 20+ accessibility issues to meet WCAG AA, improving audit scores across key pages.",
          ],
        },
      ],
    },
  },
  {
    id: "b3",
    type: "skills",
    label: "Skills",
    enabled: true,
    data: {
      groups: [
        { name: "Languages", items: "TypeScript, Python, Java, SQL" },
        { name: "Frameworks", items: "React, FastAPI, Spring Boot" },
        { name: "Tools", items: "Git, Docker, Supabase, Postgres" },
      ],
    },
  },
  {
    id: "b4",
    type: "education",
    label: "Education",
    enabled: true,
    data: {
      items: [
        {
          school: "University of Texas at Arlington",
          degree: "B.S. Computer Science",
          dates: "Expected May 2027",
          detail: "Relevant coursework: Software Engineering, Databases, Computer Networks.",
        },
      ],
    },
  },
  {
    id: "b5",
    type: "projects",
    label: "Projects",
    enabled: false,
    data: {
      items: [
        {
          name: "Easy Resume Builder",
          detail: "Block-based resume editor with drag-and-drop sections and ATS feedback. React, TypeScript, Supabase.",
        },
      ],
    },
  },
];

// Resume "versions" you could have applied with.
const RESUMES = [
  { id: "r1", name: "General SWE — v2" },
  { id: "r2", name: "Backend-focused" },
  { id: "r3", name: "Frontend-focused" },
];

// Applications for the tracker.
let APPLICATIONS = [
  { id: "a1", employer: "Stripe", role: "Backend Intern", status: "Interview", resumeId: "r2", applied: "2026-08-14" },
  { id: "a2", employer: "Figma", role: "Frontend Intern", status: "Applied", resumeId: "r3", applied: "2026-08-20" },
  { id: "a3", employer: "Vercel", role: "SWE Intern", status: "Accepted", resumeId: "r1", applied: "2026-07-30" },
  { id: "a4", employer: "Datadog", role: "Software Engineer", status: "Rejected", resumeId: "r1", applied: "2026-07-18" },
  { id: "a5", employer: "Supabase", role: "Developer Advocate", status: "Waitlist", resumeId: "r3", applied: "2026-08-02" },
  { id: "a6", employer: "Local Startup", role: "Full-stack (contract)", status: "Take-home sent", resumeId: "r2", applied: "2026-08-22", custom: true },
];

// Canned ATS result so the button always "works" in the demo.
const ATS_RESULT = {
  score: 78,
  matched: ["React", "TypeScript", "REST", "Postgres", "testing", "accessibility"],
  missing: ["CI/CD", "Kubernetes", "GraphQL"],
  tips: [
    "Add a metric to the CMS bullet — accessibility scores or page count moved.",
    "The job description mentions CI/CD; if you've touched GitHub Actions, name it.",
    "Lead each experience bullet with an action verb in past tense for consistency.",
  ],
};
