# Implementation Plan: manageme Life Planner

This document details the architecture, file structure, database schema, and verification plan for **manageme**, an ADHD-friendly personal task and life management web application.

---

## User Review Required

> [!IMPORTANT]
> - **Theme & Mode Colors**: Work Mode will use slate/steel blue (`#4b6584`), and Home Mode will use sage green (`#20bf6b` / `#2bcbba`).
> - **Touch Gestures on Mobile**: Viewport swiping (left/right) is implemented using custom Vue touch listeners (`touchstart`, `touchend`) with a minimum threshold (e.g., 100px) to prevent accidental triggers while scrolling.
> - **SQLite Dependency**: We will use `sqlite` (with `sqlite3`) as it does not require pre-compiled C++ binaries, avoiding potential node-gyp compilation failures on Windows.

---

## Proposed Changes

We will build the application in a monorepo structure inside `c:\dev\manageme`:
- `backend/` for the Express server and SQLite database logic.
- `frontend/` for the Vue 3 + Vite frontend application.
- Root directory (`package.json`) to run both concurrently.

```
c:\dev\manageme/
├── backend/
│   ├── database.js
│   ├── index.js
│   ├── recurrence.js
│   ├── package.json
│   └── data/ (gitignored folder for database.sqlite)
├── frontend/
│   ├── index.html
│   ├── src/
│   │   ├── main.js
│   │   ├── App.vue
│   │   ├── style.css
│   │   └── components/
│   │       ├── TaskList.vue
│   │       ├── TaskItem.vue
│   │       ├── TaskDrawer.vue
│   │       └── TaskInput.vue
│   └── package.json
├── package.json
└── README.md
```

---

### Root Configuration

#### [NEW] [package.json](file:///c:/dev/manageme/package.json)
The root `package.json` will manage dependency installation and run both backend and frontend concurrently in development mode.
- Scripts: `install:all`, `dev` (using concurrently to run frontend and backend).

---

### Backend Component

The backend will be built with Node.js and Express, storing data in SQLite.

#### [NEW] [backend/package.json](file:///c:/dev/manageme/backend/package.json)
Dependencies: `express`, `cors`, `sqlite`, `sqlite3`, `dotenv`.

#### [NEW] [backend/database.js](file:///c:/dev/manageme/backend/database.js)
Initializes the SQLite database and executes migrations if tables do not exist.
- Schema:
  - **`tasks`**:
    - `id` INTEGER PRIMARY KEY AUTOINCREMENT
    - `title` TEXT
    - `mode` TEXT (work/home)
    - `completed` INTEGER (0/1)
    - `completed_at` TEXT (ISO datetime or date)
    - `created_at` TEXT (ISO datetime)
    - `someday` INTEGER (0/1)
    - `schedule_id` INTEGER (nullable foreign key)
    - `tags` TEXT (JSON array of strings)
  - **`schedules`**:
    - `id` INTEGER PRIMARY KEY AUTOINCREMENT
    - `title` TEXT
    - `mode` TEXT (work/home)
    - `tags` TEXT (JSON array of strings)
    - `frequency` TEXT (weekly, monthly, yearly)
    - `frequency_data` TEXT (JSON string detailing schedule e.g. weekly days: `[1, 5]`)
    - `someday` INTEGER (0/1)
    - `last_spawned_date` TEXT (YYYY-MM-DD)
    - `created_at` TEXT

#### [NEW] [backend/recurrence.js](file:///c:/dev/manageme/backend/recurrence.js)
Implements recurring task generation on page load.
- On frontend request to `/api/tasks` or `/api/check-recurrence`, the server will:
  1. Retrieve all active schedules.
  2. For each schedule, calculate which dates need a spawned task between `last_spawned_date` (or schedule's `created_at` if NULL) and today's date.
  3. Insert corresponding tasks into the `tasks` database.
  4. Update `last_spawned_date` to today's date YYYY-MM-DD.

#### [NEW] [backend/index.js](file:///c:/dev/manageme/backend/index.js)
Main server file containing REST API endpoints:
- `GET /api/tasks` - Returns all tasks (including checking and spawning recurring tasks).
- `POST /api/tasks` - Creates a new task.
- `PUT /api/tasks/:id` - Updates a task.
- `DELETE /api/tasks/:id` - Deletes a task.
- `GET /api/schedules` - Returns all recurrence schedules.
- `POST /api/schedules` - Creates a new schedule.
- `PUT /api/schedules/:id` - Updates a schedule.
- `DELETE /api/schedules/:id` - Deletes a schedule.

---

### Frontend Component

Built with Vue 3, Vite, and standard styling.

#### [NEW] [frontend/package.json](file:///c:/dev/manageme/frontend/package.json)
Dependencies: `vue`, standard Vite devDependencies.

#### [NEW] [frontend/src/style.css](file:///c:/dev/manageme/frontend/src/style.css)
Declares root design tokens using CSS variables for dark mode and dynamic colors for Home vs. Work modes.
- Defines subtle transition effects for themes.
- Gold font transition for the 3/3 daily counter completion.

#### [NEW] [frontend/src/App.vue](file:///c:/dev/manageme/frontend/src/App.vue)
Main coordinator.
- Manages application-wide state: `currentMode` ('work' | 'home'), `showSomeday` (boolean), `tasks`, `schedules`.
- Implements touch-swipe handlers on the body/main wrapper for mode switching:
  - Swipe left -> Switch to Work Mode
  - Swipe right -> Switch to Home Mode
- Performs API calls to fetch/sync tasks on load.
- Computes daily target count: filters tasks completed today (matching current calendar day) and checks if count >= 3.

#### [NEW] [frontend/src/components/TaskInput.vue](file:///c:/dev/manageme/frontend/src/components/TaskInput.vue)
Fast entry input.
- Text input parses out `#tags` automatically on submit.
- Hides advanced options (schedule, mode, someday flag) in an accordion drawer.
- Opens advanced options on "Advanced Options" toggle click or when pressing `Tab` inside the title input.

#### [NEW] [frontend/src/components/TaskList.vue](file:///c:/dev/manageme/frontend/src/components/TaskList.vue)
Displays tasks sorted by `created_at` ascending.
- Automatically clusters tasks with shared tags.
- Clusters display as `📦 #tag-name (N tasks)` and can be clicked to toggle expansion inline.
- Shows plain tasks (unclustered) and expanded cluster tasks.

#### [NEW] [frontend/src/components/TaskDrawer.vue](file:///c:/dev/manageme/frontend/src/components/TaskDrawer.vue)
Details editor (slides in from right/overlay).
- Allows modification of task name, tags, Work/Home mode, schedule, and deletion.

---

## Verification Plan

### Automated Tests
- Verification of basic server endpoints using `curl` or simple node scripts.

### Manual Verification
- **Aesthetic check**: Verify dark mode contrast and distinct mode palettes (slate blue vs. sage green).
- **Gamification**: Complete 3 tasks and verify that the counter shifts to a gold font.
- **Swipe gestures**: Simulate swipe gestures in Chrome DevTools mobile emulator.
- **Tag bundling**: Create multiple tasks with `#test-tag` and confirm they collapse into a bundle. Click to expand.
- **Recurrence engine**: Create a schedule, adjust the schedule's `last_spawned_date` back in the SQLite database, refresh the app, and verify that the tasks spawn correctly.
