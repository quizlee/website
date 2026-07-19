# Product Requirements Document (PRD)
## Quizlee — Interactive Learning Web & Mobile App (Class 1–10)

**Version:** 1.0
**Document Owner:** Product Team
**Prepared for:** Development via Google Antigravity
**Date:** July 2026

---

## 1. Executive Summary

**Quizlee** is a gamified, curriculum-aligned learning platform for students of Class 1 to 10. Teachers create and manage interactive learning content (Quiz, Flashcards, Matching, Picture Games, and future game types) organized under a **School > Class > Subject > Chapter** hierarchy. Students play these activities in either a relaxed **Practice** mode or a timed **Competitive** mode, earning points and climbing leaderboards.

The platform is a single codebase delivering:
- A **responsive web app** (desktop + mobile browser)
- A **native Android app** (via Capacitor)
- A lightweight, functional **Admin Panel** for platform governance

---

## 2. Goals & Objectives

| Goal | Description |
|---|---|
| Engagement | Make learning fun through playful UI, gamification, and instant feedback (animations, points, ranks) |
| Curriculum Alignment | Keep all content strictly structured under School > Class > Subject > Chapter |
| Teacher Empowerment | Let verified teachers create/manage content efficiently, including bulk import |
| Governance | Give admins full control and visibility over teachers, content, and platform activity |
| Cross-Platform Reach | One codebase → Web (cPanel hosted) + Android app (Capacitor), fully responsive |

---

## 3. Tech Stack

| Layer | Technology |
|---|---|
| Frontend Framework | React + Vite |
| Mobile Wrapper | Capacitor (Android build) |
| Backend / Database / Auth / Storage | Supabase (Connected - Project: Quizlee, Ref: mwmnnzftujawqtdwulje) Postgres, Auth, Storage, Realtime, Row Level Security |
| Hosting (Web) | cPanel (static build deployment) |
| Hosting (Native) | Google Play (Capacitor Android APK/AAB) |
| Styling | Tailwind CSS (recommended, for rapid responsive + theming support) |
| State Management | React Context / Zustand (lightweight, recommended) |

### 3.1 Key Technical Constraints
- **Fully responsive**: same codebase must adapt cleanly between mobile web, desktop web, and the Capacitor-wrapped Android app.
- **Android UI constraint**: The native app must **not run in true fullscreen/edge-to-edge immersive mode**. Android's status bar and navigation bar must always remain visible. This must be explicitly configured in Capacitor's Android configuration (`StatusBar` plugin set to non-overlay, `windowSoftInputMode` and safe-area handling configured, immersive mode disabled) to avoid UX issues with system UI being hidden.
- **Deployment-ready**: production build must be static-hostable on shared cPanel hosting (no Node server required at runtime — Supabase acts as the backend).

---

## 4. User Roles

| Role | Access Point | Verification Required |
|---|---|---|
| **Admin** | `domainname/1234/admin` | Fixed credentials set once at first-time setup |
| **Teacher** | Main app (Teacher login) | Must be verified by Admin before content-management access is unlocked |
| **Student/User** | Main app (Student login) | No verification required; Google or Guest login |

---

## 5. Admin Panel

### 5.1 Access & Setup
- Accessible only via a non-guessable route: **`domainname/1234/admin`**
- **First-time setup flow**: on first admin access, a one-time setup screen lets the super-admin set the admin email + password.
- Once created, admin credentials are fixed (no public self-registration for admin accounts). A "Change Password" option can exist within the panel itself, but there is no public sign-up.
- Simple, functional, minimal UI — no need for rich visuals, animations, or the playful design language used in the student/teacher app. Clean tables, forms, and basic dashboard cards are sufficient.

### 5.2 Core Admin Features

**a) Teacher Verification**
- Queue of pending teacher sign-ups showing name, email, school, subject(s) claimed.
- Approve / Reject actions with optional rejection reason.
- Approved teachers get unlocked content-management access; rejected/unverified teachers remain restricted to a "pending approval" screen.

**b) Curriculum Management (CRUD)**
- Manage **Schools**: add / edit / delete
- Manage **Classes** (per school or global, e.g., Class 1–10): add / edit / delete
- Manage **Subjects** (per class): add / edit / delete
- Manage **Chapters** (per subject): add / edit / delete
- Manage **Content/Questions** (view/edit/delete at platform level — oversight over what teachers have created, with ability to intervene on inappropriate/incorrect content)

**c) Leaderboard Oversight**
- View leaderboards segmented by school, class, and subject.
- Read-only view for monitoring engagement across schools.

**d) Teacher Activity Log**
- Audit trail: which teacher added/edited/deleted what content and when (e.g., "Teacher X edited Question #123 in Class 5 > Science > Chapter 2 — 10 July 2026, 3:42 PM").
- Filterable by teacher, school, date range, action type.

**e) User Management (Students & Teachers)**
- Full list of all users (students + teachers) with search/filter (by school, class, role, status).
- Edit user details.
- Delete user (with confirmation).
- **Status management**: Active / Suspended / Banned toggle for any user account.

**f) Analytics Dashboard**
- Platform-level KPIs: total students, total teachers, total schools, total activities played, total questions in bank.
- Engagement trends (activities played over time, active users over time).
- Breakdown by school/class/subject (most active, most content, etc.).

### 5.3 Admin Panel — Explicitly Out of Scope
- No theming/branding customization tools.
- No rich drag-and-drop dashboard builder.
- No multi-admin role hierarchy in v1 (single fixed admin account is sufficient unless specified otherwise later).

---

## 6. Teacher Panel

### 6.1 Authentication
- Sign up via **Google Login** or **Email/Password Registration**.
- **Password Recovery** flow (forgot password → email reset link, via Supabase Auth).
- After registration, account status = **"Pending Verification."** Teacher sees a waiting-approval screen and cannot access content tools until Admin approves.

### 6.2 Post-Verification Capabilities

**a) Curriculum Navigation**
- Hierarchical selector: **School > Class > Subject > Chapter** to filter which content bucket they're managing.
- Add / Edit / Delete questions/content scoped to the selected Chapter.

**b) Bulk Content Import**
- Import content in bulk via a structured text format, with a **distinct format per activity type**:
  - Quiz (question, options, correct answer, optional hint/explanation)
  - Flashcards (front/back pairs)
  - Matching (pairs of items to match)
  - Picture Games (image reference + associated answer/label)
  - Extensible format spec so future activity types can define their own import schema
- Provide a downloadable **template/sample format** per activity type within the UI, plus validation feedback (e.g., "Row 12: missing correct answer") before final import.

**c) Teacher Dashboard**
- Total questions created (by them / by chapter).
- Active students (in their school/class scope).
- Average score across their content.

### 6.3 Teacher Panel — Design Note
- Uses the same playful design system as the student app, but functionally geared toward content management (forms, tables, hierarchical trees) — visually consistent, not admin-style bare-bones.

---

## 7. Student / User Panel

### 7.1 Authentication
- **Google Login** or **Guest Login**.
- Registration collects: username, gender, date of birth, school, class.
- **Password Recovery** flow for registered (non-guest) accounts.
- Guest accounts should have a clear upgrade path to a full account (to preserve progress) — recommended, since guest data would otherwise risk being lost.

### 7.2 Navigation
- **Mobile**: Bottom navigation bar.
- **Desktop**: Sidebar navigation.
- Both must map to the same core sections: Home, Choose Content, Leaderboard, History, Account.

### 7.3 Home Screen
- Snapshot stats: points earned, activities played, current rank.
- Quick access to "Choose Content" and "Activity Panel."

### 7.4 Choose Content Flow
- Student selects Class > Subject > Chapter (defaulted/filtered to their own school where applicable).
- **Multi-chapter selection supported** (e.g., practice across 2–3 chapters at once).

### 7.5 Activity Panel
- Activity types: **Quiz, Flashcards, Matching, Picture Games**, extensible for future game types.
- Each activity offers two configuration modes, chosen before play:

| Mode | Question Count | Time Limit | Hints | Answer Visibility | Retry | Leaderboard |
|---|---|---|---|---|---|---|
| **Practice** | Student selects count | None | Available | Shown on result | Unlimited retries | Not shown on leaderboard |
| **Competitive** | Fixed (system-defined) | Timed | Not available | Not detailed (score only) | etry Once a week | Name shown on leaderboard |

### 7.6 Result Screen
- Displays: time taken, score percentage, correct answers count, points earned.
- Includes celebratory feedback per the animation requirements (Section 9).

### 7.7 Leaderboard Panel
- Shows number of participants within the student's school, ranked by score.
- Filter options recommended: by class/subject/all-time vs. recent, if useful — core requirement is school-based leaderboard.

### 7.8 History Panel
- List of previously played activities: activity type, chapter, date, score.

### 7.9 Account Section
- Change profile picture.
- **Privacy Setting**:
  - **Public**: full profile details visible to others.
  - **Private**: only name, profile picture, and score are visible to others.

---

## 8. UI/UX Design Requirements

- **Visual tone**: Highly attractive, playful, vibrant, and child-friendly.
- **Shapes**: Rounded corners throughout (cards, buttons, inputs).
- **Color palette**: Soft pastel and/or bright, cheerful backgrounds.
- **Iconography**: Clear, fun icons and/or emojis for navigation and actions.
- **Typography**: Clear, highly readable, kid-friendly fonts (avoid dense/serif fonts; favor rounded sans-serif).
- **Feedback animations**:
  - Correct answer → green bounce + confetti effect.
  - Incorrect answer → gentle red shake (non-punitive, friendly tone).
- **Responsiveness**: Layouts adapt cleanly across mobile, tablet, and desktop breakpoints, plus the Capacitor-wrapped Android shell.
- **Admin Panel exception**: functional, minimal, table/form-driven UI — no need for the playful design system.

---

## 9. Data Model (High-Level Entities)

- **Schools** — id, name, address (optional), status
- **Classes** — id, name (Class 1–10), school reference (or global)
- **Subjects** — id, name, class reference
- **Chapters** — id, name, subject reference
- **Content/Questions** — id, chapter reference, activity type, payload (question/options/answer/media), created_by (teacher), timestamps
- **Users** — id, role (admin/teacher/student), auth provider, profile fields, status (active/suspended/banned)
- **Teacher Profile** — verification status, verified_by, verified_at
- **Student Profile** — username, gender, DOB, school, class, privacy setting (public/private)
- **Activity Attempts/Results** — user reference, content/chapter reference, mode (practice/competitive), score, time taken, points earned, timestamp
- **Leaderboard (derived/view)** — aggregated scores per school/class/subject
- **Activity Log (audit)** — teacher id, action type, target entity, timestamp, before/after summary

> Row Level Security (RLS) in Supabase should enforce: teachers can only manage content they created or are scoped to; students can only read content relevant to their school/class; admin has full access via a service role or elevated policy.

---

## 10. Non-Functional Requirements

- **Performance**: Fast load on shared cPanel hosting — static asset optimization via Vite build, lazy-loading routes.
- **Security**: Supabase Auth for all login flows; RLS policies enforced at the database level; admin route obscured but should not be the sole security control (must still require proper authentication).
- **Scalability**: Schema designed to support growth in schools/classes without redesign.
- **Offline/Guest handling**: Guest sessions should be clearly temporary, with a prompt to convert to a full account.
- **Native App UX**: Non-fullscreen/edge-to-edge display on Android — status bar and navigation bar always visible, safe-area insets respected in layout.

---

## 11. Deployment Plan

| Component | Deployment Target |
|---|---|
| Web App (React + Vite build) | Static build uploaded to cPanel hosting |
| Backend | Supabase project (hosted, managed) |
| Android App | Capacitor build → APK/AAB → Google Play (or direct distribution) |

---

## 12. Future Considerations (Out of Scope for v1, Noted for Roadmap)

- Additional activity/game types beyond the four launch types.
- iOS app via Capacitor (currently Android-only per requirements).
- Multi-admin roles/permission tiers.
- Push notifications for engagement (streaks, reminders).
- Parent/guardian view.

---

## 13. Open Questions for Stakeholder Confirmation

1. Are Schools globally shared across all teachers/students, or does each school operate as an isolated tenant (data-wise)?
2. For Competitive mode, is the question count/time limit fixed platform-wide, or configurable per chapter/content by the teacher?
3. Should guest student accounts have any progress-saving mechanism, or are they fully session-based?
4. Should the leaderboard be visible platform-wide (cross-school) anywhere, or strictly school-scoped as described?
