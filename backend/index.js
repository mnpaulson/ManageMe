import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

import { getDb } from './database.js';
import { checkAndSpawnRecurringTasks } from './recurrence.js';
import * as freshservice from './freshservice.js';

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Helper: Extract tags from title (e.g. #kitchen-remodel -> ["#kitchen-remodel"])
function extractTags(title) {
  if (!title) return [];
  const regex = /#[a-zA-Z0-9-_]+/g;
  const matches = title.match(regex);
  if (!matches) return [];
  // Grab the last matched tag only
  return [matches[matches.length - 1].toLowerCase()];
}

// ---------------- TASK ENDPOINTS ----------------

// GET all tasks (triggers recurrence check first)
app.get('/api/tasks', async (req, res) => {
  try {
    const db = await getDb();

    // Check and spawn recurring tasks on page load / fetch
    await checkAndSpawnRecurringTasks(db);

    const tasks = await db.all('SELECT * FROM tasks ORDER BY created_at ASC');

    // Parse JSON tags
    const formattedTasks = tasks.map(task => ({
      ...task,
      tags: JSON.parse(task.tags || '[]')
    }));

    res.json(formattedTasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST new task
app.post('/api/tasks', async (req, res) => {
  try {
    const db = await getDb();
    const { title, mode, someday, schedule_id, due_date, keep_active, notes, is_freshservice, freshservice_ticket_id, resolution_notes, requester } = req.body;

    if (!title || !mode) {
      return res.status(400).json({ error: 'Title and mode are required' });
    }

    const created_at = new Date().toISOString();
    const parsedTags = extractTags(title);
    const tagsString = JSON.stringify(parsedTags);
    const isSomeday = someday ? 1 : 0;
    const isKeepActive = keep_active ? 1 : 0;
    const isFS = is_freshservice ? 1 : 0;
    const fsTicketId = freshservice_ticket_id || null;
    const resNotes = resolution_notes || null;
    const reqEmail = requester || null;

    // Get max sort_order to place task at the bottom
    const maxRow = await db.get('SELECT MAX(sort_order) as maxOrder FROM tasks');
    const nextOrder = (maxRow && maxRow.maxOrder !== null) ? maxRow.maxOrder + 1 : 1;

    const result = await db.run(
      `INSERT INTO tasks (title, mode, completed, completed_at, created_at, someday, schedule_id, tags, due_date, keep_active, notes, sort_order, starred, is_freshservice, freshservice_ticket_id, resolution_notes, requester)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, mode, 0, null, created_at, isSomeday, schedule_id || null, tagsString, due_date || null, isKeepActive, notes || null, nextOrder, 0, isFS, fsTicketId, resNotes, reqEmail]
    );

    const newTask = await db.get('SELECT * FROM tasks WHERE id = ?', [result.lastID]);
    res.status(201).json({
      ...newTask,
      tags: JSON.parse(newTask.tags || '[]')
    });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PUT bulk reorder tasks
app.put('/api/tasks/reorder', async (req, res) => {
  try {
    const db = await getDb();
    const { orders } = req.body; // array of { id, sort_order, starred }

    if (!Array.isArray(orders)) {
      return res.status(400).json({ error: 'Orders array is required' });
    }

    await db.run('BEGIN TRANSACTION');
    for (const item of orders) {
      await db.run(
        'UPDATE tasks SET sort_order = ?, starred = ? WHERE id = ?',
        [item.sort_order, item.starred !== undefined ? (item.starred ? 1 : 0) : 0, item.id]
      );
    }
    await db.run('COMMIT');

    res.json({ success: true });
  } catch (error) {
    try {
      const db = await getDb();
      await db.run('ROLLBACK');
    } catch (e) {
      // Ignore rollback error
    }
    console.error('Error reordering tasks:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PUT update task
app.put('/api/tasks/:id', async (req, res) => {
  try {
    const db = await getDb();
    const { id } = req.params;
    const { title, mode, completed, someday, tags, due_date, keep_active, notes, starred, sort_order, is_freshservice, freshservice_ticket_id, resolution_notes, requester } = req.body;

    const existingTask = await db.get('SELECT * FROM tasks WHERE id = ?', [id]);
    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    let newCompleted = completed !== undefined ? (completed ? 1 : 0) : existingTask.completed;
    let completed_at = existingTask.completed_at;
    if (completed !== undefined) {
      if (newCompleted !== existingTask.completed) {
        completed_at = newCompleted ? new Date().toISOString() : null;
      }
    }

    const newTitle = title || existingTask.title;
    const newMode = mode || existingTask.mode;
    const newSomeday = someday !== undefined ? (someday ? 1 : 0) : existingTask.someday;
    const newDueDate = due_date !== undefined ? due_date : existingTask.due_date;
    const newKeepActive = keep_active !== undefined ? (keep_active ? 1 : 0) : existingTask.keep_active;
    const newNotes = notes !== undefined ? notes : existingTask.notes;
    const newStarred = starred !== undefined ? (starred ? 1 : 0) : existingTask.starred;
    const newSortOrder = sort_order !== undefined ? sort_order : existingTask.sort_order;
    const newIsFS = is_freshservice !== undefined ? (is_freshservice ? 1 : 0) : existingTask.is_freshservice;
    const newFsTicketId = freshservice_ticket_id !== undefined ? freshservice_ticket_id : existingTask.freshservice_ticket_id;
    const newResNotes = resolution_notes !== undefined ? resolution_notes : existingTask.resolution_notes;
    const newRequester = requester !== undefined ? requester : existingTask.requester;
    const newScheduleId = (newIsFS === 1 || newFsTicketId) ? null : existingTask.schedule_id;

    // Validation: cannot complete a Freshservice task without resolution notes
    if (newCompleted === 1 && newIsFS === 1) {
      if (!newResNotes || !newResNotes.trim()) {
        return res.status(400).json({ error: 'Resolution notes are required to complete a Freshservice task' });
      }
    }

    // Sync status and resolution notes to Freshservice if ticket exists
    if (newIsFS === 1 && newFsTicketId && freshservice.isEnabled()) {
      const cleanSubject = newTitle.replace(/#[a-zA-Z0-9-_]+/g, '').replace(/\s+/g, ' ').trim();
      if (newCompleted === 1 && existingTask.completed === 0) {
        await freshservice.updateTicket(newFsTicketId, 4, cleanSubject, newNotes, newResNotes);
      } else if (newSomeday === 1 && existingTask.someday === 0) {
        await freshservice.updateTicket(newFsTicketId, 3, cleanSubject, newNotes, newResNotes);
      }
    }

    // If tags are provided, use them; otherwise extract from the title
    const finalTags = tags ? tags : extractTags(newTitle);
    const tagsString = JSON.stringify(finalTags);

    await db.run(
      `UPDATE tasks 
       SET title = ?, mode = ?, completed = ?, completed_at = ?, someday = ?, tags = ?, due_date = ?, keep_active = ?, notes = ?, starred = ?, sort_order = ?, is_freshservice = ?, freshservice_ticket_id = ?, resolution_notes = ?, schedule_id = ?, requester = ?
       WHERE id = ?`,
      [newTitle, newMode, newCompleted, completed_at, newSomeday, tagsString, newDueDate, newKeepActive, newNotes, newStarred, newSortOrder, newIsFS, newFsTicketId, newResNotes, newScheduleId, newRequester, id]
    );

    const updatedTask = await db.get('SELECT * FROM tasks WHERE id = ?', [id]);
    res.json({
      ...updatedTask,
      tags: JSON.parse(updatedTask.tags || '[]')
    });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



// DELETE task
app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const db = await getDb();
    const { id } = req.params;

    const result = await db.run('DELETE FROM tasks WHERE id = ?', [id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ success: true, message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ---------------- SCHEDULE ENDPOINTS ----------------

// GET all schedules
app.get('/api/schedules', async (req, res) => {
  try {
    const db = await getDb();
    const schedules = await db.all('SELECT * FROM schedules');

    const formattedSchedules = schedules.map(sched => ({
      ...sched,
      tags: JSON.parse(sched.tags || '[]'),
      frequency_data: JSON.parse(sched.frequency_data || '{}')
    }));

    res.json(formattedSchedules);
  } catch (error) {
    console.error('Error fetching schedules:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST new schedule
app.post('/api/schedules', async (req, res) => {
  try {
    const db = await getDb();
    const { title, mode, frequency, frequency_data, someday } = req.body;

    if (!title || !mode || !frequency) {
      return res.status(400).json({ error: 'Title, mode, and frequency are required' });
    }

    const created_at = new Date().toISOString();
    const parsedTags = extractTags(title);
    const tagsString = JSON.stringify(parsedTags);
    const freqDataString = JSON.stringify(frequency_data || {});
    const isSomeday = someday ? 1 : 0;

    const result = await db.run(
      `INSERT INTO schedules (title, mode, tags, frequency, frequency_data, someday, last_spawned_date, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, mode, tagsString, frequency, freqDataString, isSomeday, null, created_at]
    );

    const newSchedule = await db.get('SELECT * FROM schedules WHERE id = ?', [result.lastID]);
    res.status(201).json({
      ...newSchedule,
      tags: JSON.parse(newSchedule.tags || '[]'),
      frequency_data: JSON.parse(newSchedule.frequency_data || '{}')
    });
  } catch (error) {
    console.error('Error creating schedule:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PUT update schedule
app.put('/api/schedules/:id', async (req, res) => {
  try {
    const db = await getDb();
    const { id } = req.params;
    const { title, mode, frequency, frequency_data, someday, tags } = req.body;

    const existingSched = await db.get('SELECT * FROM schedules WHERE id = ?', [id]);
    if (!existingSched) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    const newTitle = title || existingSched.title;
    const newMode = mode || existingSched.mode;
    const newFrequency = frequency || existingSched.frequency;
    const newFreqData = frequency_data ? JSON.stringify(frequency_data) : existingSched.frequency_data;
    const newSomeday = someday !== undefined ? (someday ? 1 : 0) : existingSched.someday;
    const finalTags = tags ? tags : extractTags(newTitle);
    const tagsString = JSON.stringify(finalTags);

    await db.run(
      `UPDATE schedules 
       SET title = ?, mode = ?, tags = ?, frequency = ?, frequency_data = ?, someday = ?
       WHERE id = ?`,
      [newTitle, newMode, tagsString, newFrequency, newFreqData, newSomeday, id]
    );

    const updatedSched = await db.get('SELECT * FROM schedules WHERE id = ?', [id]);
    res.json({
      ...updatedSched,
      tags: JSON.parse(updatedSched.tags || '[]'),
      frequency_data: JSON.parse(updatedSched.frequency_data || '{}')
    });
  } catch (error) {
    console.error('Error updating schedule:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// DELETE schedule
app.delete('/api/schedules/:id', async (req, res) => {
  try {
    const db = await getDb();
    const { id } = req.params;

    const result = await db.run('DELETE FROM schedules WHERE id = ?', [id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    res.json({ success: true, message: 'Schedule deleted successfully' });
  } catch (error) {
    console.error('Error deleting schedule:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ---------------- FRESHSERVICE ENDPOINTS ----------------

app.get('/api/freshservice/config', (req, res) => {
  res.json({ enabled: freshservice.isEnabled(), domain: freshservice.domain });
});

app.post('/api/freshservice/sync-pull', async (req, res) => {
  try {
    if (!freshservice.isEnabled()) {
      return res.status(400).json({ error: 'Freshservice integration is disabled' });
    }

    // 1. Get authenticated agent details
    const agent = await freshservice.getAgentMe();
    const agentId = agent.id;
    const agentEmail = agent.email;

    // 2. Fetch assigned tickets (status 2 = Open and 3 = Pending only)
    const tickets = await freshservice.getAssignedTickets(agentId);

    const db = await getDb();
    let newTasksCount = 0;
    let updatedTasksCount = 0;

    await db.run('BEGIN TRANSACTION');

    for (const ticket of tickets) {
      // Check if a task already exists with this freshservice_ticket_id
      const existingTask = await db.get('SELECT * FROM tasks WHERE freshservice_ticket_id = ?', [ticket.id]);

      const isCompleted = (ticket.status === 4 || ticket.status === 5) ? 1 : 0;
      const completedAt = isCompleted ? (ticket.updated_at || new Date().toISOString()) : null;

      // Format title: use ticket.subject directly
      const title = ticket.subject;
      const parsedTags = []; // Do not auto-tag tasks synced from freshservice
      const tagsString = JSON.stringify(parsedTags);

      const notes = ticket.description || 'No description provided';
      const resNotes = ticket.resolution_notes || null;

      if (!existingTask) {
        // Insert new task in "work" mode
        const created_at = ticket.created_at || new Date().toISOString();

        // Get max sort_order
        const maxRow = await db.get('SELECT MAX(sort_order) as maxOrder FROM tasks');
        const nextOrder = (maxRow && maxRow.maxOrder !== null) ? maxRow.maxOrder + 1 : 1;

        await db.run(
          `INSERT INTO tasks (title, mode, completed, completed_at, created_at, someday, schedule_id, tags, due_date, keep_active, notes, sort_order, starred, is_freshservice, freshservice_ticket_id, resolution_notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [title, 'work', isCompleted, completedAt, created_at, 0, null, tagsString, null, 0, notes, nextOrder, 0, 1, ticket.id, resNotes]
        );
        newTasksCount++;
      } else {
        // Update existing task title, notes, completed, tags
        await db.run(
          `UPDATE tasks 
           SET title = ?, completed = ?, completed_at = ?, tags = ?, notes = ?, is_freshservice = 1, resolution_notes = ?, schedule_id = NULL
           WHERE id = ?`,
          [title, isCompleted, completedAt, tagsString, notes, resNotes, existingTask.id]
        );
        updatedTasksCount++;
      }
    }

    await db.run('COMMIT');

    res.json({ success: true, newTasksCount, updatedTasksCount });
  } catch (error) {
    try {
      const db = await getDb();
      await db.run('ROLLBACK');
    } catch (e) {
      // ignore
    }
    console.error('Error in freshservice sync-pull:', error);
    res.status(500).json({ error: error.message || 'Failed to sync tickets' });
  }
});

app.post('/api/freshservice/sync-push/:taskId', async (req, res) => {
  try {
    if (!freshservice.isEnabled()) {
      return res.status(400).json({ error: 'Freshservice integration is disabled' });
    }

    const { taskId } = req.params;
    const db = await getDb();

    const task = await db.get('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (task.mode !== 'work') {
      return res.status(400).json({ error: 'Only Work tasks can be synced with Freshservice' });
    }

    // Clean title to remove tag for Freshservice subject
    const cleanSubject = task.title.replace(/#[a-zA-Z0-9-_]+/g, '').replace(/\s+/g, ' ').trim();

    let ticket;
    if (!task.freshservice_ticket_id) {
      // Create ticket in Freshservice
      const agent = await freshservice.getAgentMe();
      ticket = await freshservice.createTicket(cleanSubject, task.notes, agent.email, agent.id, task.requester);

      // Update task in database
      await db.run(
        'UPDATE tasks SET freshservice_ticket_id = ?, is_freshservice = 1, schedule_id = NULL WHERE id = ?',
        [ticket.id, task.id]
      );
    } else {
      // Update existing ticket
      const status = task.completed === 1 ? 4 : (task.someday === 1 ? 3 : 2); // 4 = Resolved, 3 = Pending, 2 = Open
      const resNotes = task.completed === 1 ? (task.resolution_notes || 'Resolved via manageme') : null;

      ticket = await freshservice.updateTicket(task.freshservice_ticket_id, status, cleanSubject, task.notes, resNotes);

      // Make sure local is_freshservice flag is set
      await db.run(
        'UPDATE tasks SET is_freshservice = 1, schedule_id = NULL WHERE id = ?',
        [task.id]
      );
    }

    const updatedTask = await db.get('SELECT * FROM tasks WHERE id = ?', [taskId]);
    res.json({
      success: true,
      task: {
        ...updatedTask,
        tags: JSON.parse(updatedTask.tags || '[]')
      }
    });
  } catch (error) {
    console.error('Error in freshservice sync-push:', error);
    res.status(500).json({ error: error.message || 'Failed to push ticket' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
