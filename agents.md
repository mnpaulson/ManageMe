# manageme Developer & Agent Onboarding Guide

Welcome to the **manageme** project! This document serves as a comprehensive onboarding guide for developers and AI agents working on this codebase. It documents the architecture, directory structure, design philosophy, API endpoints, and critical UX constraints/gotchas.

---

## 🚀 Project Overview
**manageme** is a self-hosted, ADHD-friendly personal task and life planner designed to minimize distractions and cognitive overload. It features:
- **Dual Focus Modes**: `HOME` (sage green accent) and `WORK` (steel blue accent).
- **CLI Aesthetic**: Minimalist, flat, low-fatigue monospace interface with instant tab switching.
- **Daily Gamification**: A daily tracker (`TODAY: X` completed tasks) that turns gold when the user completes at least 3 tasks today.
- **Tag Bundling**: Automatic clustering of tasks sharing the same tag (when 2 or more tasks share it) into expandable folder headers.
- **Details Drawer**: A slide-out edit drawer from the top/center.
- **Recurrence Engine**: A page-load scheduler that retroactively spawns task instances based on recurring weekly, monthly, or yearly rules.

---

## 📁 Repository Structure

```
c:\dev\manageme/
├── backend/
│   ├── index.js           # Express main server, API endpoints & Freshservice routes
│   ├── database.js        # SQLite initialisation and queries
│   ├── freshservice.js    # Freshservice API client helper (Basic Auth proxy)
│   ├── recurrence.js      # Recurring task generation engine
│   ├── package.json       # Backend dependencies (express, sqlite, sqlite3, cors, dotenv)
│   └── data/              # Gitignored database folder (contains database.sqlite)
├── frontend/
│   ├── index.html
│   ├── src/
│   │   ├── main.js
│   │   ├── App.vue        # Coordinator component (state, local caching, toast notifications)
│   │   ├── style.css      # Core CLI design tokens, layouts, drawer, and mode variables
│   │   └── components/
│   │       ├── TaskInput.vue        # Fast entry bar with collapsible advanced options
│   │       ├── TaskList.vue         # Bundling list wrapper (clusters shared tags)
│   │       ├── TaskItem.vue         # Individual task row with status checkbox, action dropdown, logo badges
│   │       ├── TaskDrawer.vue       # Details edit drawer with Preview/Edit HTML notes toggle
│   │       └── ToastNotification.vue # Monospace stacked toast overlay overlay (success/error)
│   └── package.json       # Vue 3, Vite, and development tools
├── package.json           # Monorepo configuration
├── Implementation.md      # Initial setup documentation
└── agents.md              # THIS FILE (developer & agent onboarding)
```

---

## 🎨 Design Philosophy & CSS Constraints

We adhere strictly to a **flat, minimalist CLI style** designed to be low-contrast, low-fatigue, and exceptionally fast:

1. **No Emojis**: Do not use emojis in UI buttons, links, or text. Use monospace text indicators like `>_`, `[X]`, `> `, and `⋮`.
2. **Instant Transitions**: All CSS transitions are disabled globally using `* { transition: none !important; }` to support instant mode and tab switches.
3. **Mode CSS Variables**: Home/Work accents change dynamically by updating the `body` class (`mode-home` or `mode-work`). The CSS custom property `--accent` automatically adjusts to the correct color:
   - **Home**: Sage green (`#378b43`)
   - **Work**: Steel blue (`#376fab`)
4. **No Drop Shadows or Glows**: Keep interfaces flat. Do not introduce glow effects or complex gradients. Borders are solid 1px `var(--border-color)`.

---

## 🔌 Freshservice Integration

`manageme` features an optional API integration with Freshservice to sync assigned tickets as local tasks.

### 1. Credentials Configuration
Stored securely in `backend/.env` (which is gitignored):
- `FRESHSERVICE_API_KEY`: User's profile API key.
- `FRESHSERVICE_DOMAIN`: Freshservice host domain (e.g. `lethbridgepolytechnic.freshservice.com`). Leading protocols (`https://`, `http://`) and trailing slashes are automatically sanitized.
- `FRESHSERVICE_GROUP_ID`: (Optional) Manual ID mapping for the agent group (e.g. `Enterprise Systems Team`). Bypasses `403 Forbidden` errors if the API key does not have administrator privileges to list groups.

### 2. Synchronization Flow
- **Pull Sync**: Triggered via `[PULL FRESHSERVICE]` (only visible on the `WORK` active tasks view). Fetches open and pending tickets (status 2 and 3) assigned to the authenticated user from `/api/v2/tickets/filter`. Creates tasks in `WORK` mode, sets `is_freshservice = 1`, and links the `freshservice_ticket_id`. To minimize cognitive clutter, tickets pulled from Freshservice are **not** automatically tagged.
- **Push Sync**: Pushes task updates back to Freshservice via `POST /api/freshservice/sync-push/:taskId`. This either creates a new ticket or updates the existing mapped ticket. If the task has a custom `requester` email specified, it is used as the requester on the created ticket; otherwise, it falls back to the authenticated agent's own email. Mapped tickets clear the `schedule_id` column as recurrence templates and Freshservice tickets are mutually exclusive.
- **Status Mapping**: Mapped tickets are updated dynamically based on task state:
  - Task completed (`completed = 1`) -> sets status to Resolved (`4`).
  - Task moved to someday (`someday = 1`) -> sets status to Pending (`3`).
  - Task active (`completed = 0`, `someday = 0`) -> sets status to Open (`2`).

### 3. Resolution Validation
- Attempting to complete a Freshservice task without writing a non-empty `resolution_notes` will block the save, throw a `400 Bad Request` backend validation error, alert the user using the custom toast overlay, and automatically revert the checkbox.
- Completing the task with a resolution note automatically calls the Freshservice API to resolve the ticket with the note.

---

## ⚙️ Running the Project

Both the backend and frontend run concurrently in development mode using a single root command:

```bash
npm run dev
```

- **Frontend App**: runs at `http://localhost:3000` (proxies `/api` calls to port 5000)
- **Backend API Server**: runs at `http://localhost:5000`
- **Database**: SQLite file is located at `backend/data/database.sqlite`

---

## 🔄 Recurrence Engine & Backend API

### 1. Recurrence Spawning
- Recurring tasks are configured as templates in the `schedules` table.
- The recurrence engine triggers on **every load/fetch** of `GET /api/tasks` (`backend/recurrence.js`).
- It scans all schedules, calculates the dates when tasks should have spawned since `last_spawned_date` up to today's date (respecting rules for weekly, monthly, or yearly schedules), inserts the spawned tasks into `tasks`, and updates the schedule's `last_spawned_date` to today (`YYYY-MM-DD`).

### 2. Schema Outline
- **`tasks`**: `id`, `title`, `mode` (`home` / `work`), `completed` (`0` / `1`), `completed_at` (text, ISO), `created_at` (text, ISO), `someday` (`0` / `1`), `schedule_id` (nullable int), `tags` (JSON array of strings), `is_freshservice` (0/1), `freshservice_ticket_id` (nullable int), `resolution_notes` (nullable text), `requester` (nullable text)
- **`schedules`**: `id`, `title`, `mode` (`home` / `work`), `tags` (JSON array of strings), `frequency` (`weekly` / `monthly` / `yearly`), `frequency_data` (JSON string containing details like repeat days `[1, 5]`), `someday` (`0` / `1`), `last_spawned_date` (`YYYY-MM-DD`), `created_at` (text, ISO)

---

## ⚠️ Critical UX Details & Bug Gotchas

If you are modifying frontend components, keep the following implementation choices in mind:

### 1. Single Tag Constraint
To prevent tag badges from breaking task layouts, the user is limited to **a single tag per item**. 
- The tag parser on submission (`TaskInput.vue` and `TaskDrawer.vue`) accepts comma-separated values, but automatically discards all but the **last** tag entered (e.g. `#tags, #kitchen` gets normalized to `['#kitchen']`).
- Do not throw errors to the user; silently handle and normalize the input.

### 2. Task Row Click & Details Drawer
- **Clicking on a task row opens the details drawer**. Checkbox controls, action dropdowns (`⋮`), and drag handles prevent this click from bubbling via `@click.stop`.
- Task editing, moving to someday, or deleting is managed via a dedicated **Actions Dropdown menu** (`⋮` button) located on the right side of each task row, or inside the Details Drawer.
- **Dropdown Close Bug**: Clicking the vertical ellipsis symbol (`⋮`) was previously closing the dropdown because the node target was the inner text instead of the button itself. To fix this, click listeners use `.closest('.more-actions-btn')` to detect the click target.
- **Dropdown Positioning**: The dropdown list uses `position: absolute; right: 0; top: 100%;`. The parent `.actions-dropdown` has `position: relative;` to ensure correct alignment on mobile and desktop without sliding off-screen.

### 3. Task Row Alignment & Heights
- To ensure proper visual alignment between regular task items and collapsible cluster headers:
  - Both `.task-item` and `.cluster-header` have a matching height (`2.6rem` on both mobile and desktop).
  - The actions button (`.more-actions-btn`) is sized to match these heights.

### 4. Mode Switcher Tabs & Local Caching
- The `HOME` / `WORK` switcher at the top of the app stretches nearly full width (`display: flex; width: 100%;`).
- It has a custom tab styling: the active mode displays a colored underline strictly under the text (achieved by wrapping text in `<span class="tab-text">` and applying `border-bottom` on `.active-mode .tab-text` rather than on the `.mode-tab` cell).
- The current selected mode is saved to `localStorage` under the key `currentMode` so the layout state persists between reloads.

### 5. Daily Task Counter
- The daily task counter (`TODAY: X`) is located inside a custom view toolbar immediately above the tasks list.
- It is rendered **only** when the user is viewing the `ACTIVE` tab. It is hidden on `SOMEDAY`, `COMPLETED`, and `SCHEDULES` views.

### 6. HTML Notes rendering inside Drawer
- Mapped Freshservice task notes contain rich HTML text. To prevent rendering raw code, the drawer features a toggled monospace `[PREVIEW]` / `[EDIT]` selector.
- `[PREVIEW]` renders the notes block cleanly using `v-html`. Mapped tickets display their reference ID as a clickable hyperlink referencing `https://${freshserviceDomain}/a/tickets/${id}` opening in a new tab.
- Tasks containing linked ticket IDs render a custom `/LPlogo.png` image badge instead of the standard `[N]` notes badge.
