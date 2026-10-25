# Scheduled Tasks & Automation Architecture

This document details the architecture, design, and deployment notes for the Ayatrisya Scheduled Tasks and Automation system.

---

## 1. Overview & Capabilities

The Scheduled Tasks feature allows Ayatrisya users to schedule automations and reminders through natural language in chat or via the dedicated **Scheduled Tasks** workspace dashboard (`/workspace/tasks`).

Supported natural language requests include:
- *"Remind me to study Maths tomorrow at 6 PM."* (One-time reminder with subject extraction)
- *"Every morning at 7 AM, summarize my tasks."* (Daily workspace task digest)
- *"Every Sunday, generate a practice quiz."* (Weekly interactive quiz generator)
- *"Check my project status every weekday."* (Weekday code and repository status check)
- *"Remind me to review this code in three days."* (Targeted code review checkpoint)

Before any proposed task becomes active, Ayatrisya displays an interactive **Scheduled Task Confirmation Card** where users can verify the timing, recurrence, timezone, and execution target before clicking **Activate Schedule**.

---

## 2. Interactive Task Cards & Interactive Blocks Engine

Scheduled Tasks are registered as Type 29 in the Ayatrisya Interactive Blocks engine (`type: 'scheduled_task'`):

- **Status States**: `draft` (requires user confirmation), `active`, `paused`, `completed`, `failed`, and `missed` (when desktop runner is offline).
- **Controls**:
  - **Run now**: Triggers immediate execution with real-time feedback.
  - **Pause / Resume**: Toggles execution cadence without losing historical logs.
  - **Edit**: Inline editor for title, time, recurrence, and IANA timezone.
  - **Duplicate**: Clones task into a paused duplicate for fast customization.
  - **Delete**: Protected by a confirmation dialog to prevent accidental deletion.
  - **Execution History**: Collapsible drawer showing timestamp, status, duration, output, and error logs.

---

## 3. Control Plane & API Server Architecture

The Render API server (`@workspace/api-server`) serves as the central control plane:

- **Endpoints**:
  - `GET /api/tasks`: Lists tasks owned by the authenticated user.
  - `POST /api/tasks`: Creates or updates a task with timezone and recurrence validation.
  - `GET /api/tasks/:id`: Retrieves single task details with owner isolation.
  - `PATCH /api/tasks/:id`: Updates task parameters or status.
  - `POST /api/tasks/:id/run`: Immediate execution trigger.
  - `DELETE /api/tasks/:id`: Removes task and audit logs.
  - `GET /api/tasks/:id/history`: Retrieves execution logs.
  - `POST /api/tasks/heartbeat`: Heartbeat from Ayatrisya Desktop app.
  - `GET|POST /api/tasks/tick`: External cron webhook trigger.
  - `GET /api/tasks/health`: Scheduler health and platform sleep diagnostic report.

- **Storage & Crash Resilience**:
  - Tasks and execution audit trails are durably persisted in `data/scheduled-tasks.json` with atomic writes (temporary file + rename) surviving service restarts.
  - Client-side guest and offline users are backed by a dedicated IndexedDB database (`ayatrisya-tasks`), ensuring 100% offline capabilities.

- **Concurrency & Idempotency**:
  - Mutex locking per task ID (`TaskStore.acquireLock`) prevents overlapping executions.
  - 15-second idempotency window prevents duplicate executions after restarts or rapid retries.

- **Non-Eval Bounded Execution**:
  - The scheduler never evaluates or executes arbitrary AI-generated code.
  - All actions are bounded safe handlers: `study_reminder`, `task_summary`, `practice_quiz`, `project_status`, `code_review`, and `notification`.

---

## 4. Desktop Runner vs. Cloud Execution

- **Cloud Target (`executionTarget: 'cloud'`)**:
  - Executes independently on the server for all cloud-supported capabilities.
- **Desktop Target (`executionTarget: 'desktop'`)**:
  - Specifically designed for tasks that require the user's local computer, local file system, or native runner.
  - If the computer or desktop companion is offline at the scheduled run time, the system **records the run as `missed`** and notifies the user upon reconnecting.
  - The system **never silently switches local-only tasks to cloud execution**, honoring user consent and security boundaries.

---

## 5. Render Free Tier Sleep Limitation & Zero-Cost Solution

### The Limitation
On Render's free tier, web services automatically sleep (spin down) after **15 minutes of inactivity**. If no incoming HTTP requests are received, the background `setInterval` ticker pauses until the next request arrives.

### Free-Compatible Solution (No Paid Upgrades Required)
To ensure reliable, 24/7 background execution without incurring costs:
1. **External Webhook Cron Pingers**:
   - Free services such as [cron-job.org](https://cron-job.org) or [UptimeRobot](https://uptimerobot.com) can be configured to send an HTTP GET/POST request every 5–10 minutes to:
     ```
     https://<your-render-app>.onrender.com/api/tasks/tick
     ```
   - This endpoint wakes up the Render service and runs the scheduler pass (`TaskScheduler.tick()`), triggering any due tasks on time.
2. **Ayatrisya Desktop Task Runner**:
   - While the Ayatrisya Desktop application is open on the user's computer, it runs a local ticker and sends regular heartbeats to `/api/tasks/heartbeat`, executing local tasks directly.

---

## 6. Notifications & Security

- **In-App Notification Center**: Bell icon with unread badge counter displaying upcoming, completed, missed, and failed task alerts.
- **Desktop System Notifications**: Uses the Web Notifications API (`Notification.requestPermission()`) when permission is granted by the user.
- **Privacy & Authorization**: All operations enforce strict user isolation via verified Firebase UIDs. Tasks, prompts, and payloads are never exposed to other accounts.
