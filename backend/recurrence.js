function getDaysArray(startStr, endStr, includeStart) {
  const arr = [];
  const start = new Date(startStr + 'T00:00:00');
  const end = new Date(endStr + 'T00:00:00');
  
  if (start > end) return arr;
  
  let current = new Date(start);
  if (!includeStart) {
    current.setDate(current.getDate() + 1);
  }
  
  while (current <= end) {
    const yyyy = current.getFullYear();
    const mm = String(current.getMonth() + 1).padStart(2, '0');
    const dd = String(current.getDate()).padStart(2, '0');
    arr.push(`${yyyy}-${mm}-${dd}`);
    current.setDate(current.getDate() + 1);
  }
  return arr;
}

export async function checkAndSpawnRecurringTasks(db) {
  // Get today's local date string (YYYY-MM-DD)
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;

  // Fetch all schedules
  const schedules = await db.all('SELECT * FROM schedules');

  for (const schedule of schedules) {
    let checkStartDate;
    let includeStart = false;

    if (schedule.last_spawned_date) {
      checkStartDate = schedule.last_spawned_date;
      includeStart = false;
    } else {
      // If never spawned, start from created_at date in local timezone
      const createdDate = new Date(schedule.created_at);
      const cY = createdDate.getFullYear();
      const cM = String(createdDate.getMonth() + 1).padStart(2, '0');
      const cD = String(createdDate.getDate()).padStart(2, '0');
      checkStartDate = `${cY}-${cM}-${cD}`;
      includeStart = true;
    }

    // Get array of dates to check
    const datesToCheck = getDaysArray(checkStartDate, todayStr, includeStart);
    if (datesToCheck.length === 0) continue;

    // Parse frequency_data
    let freqData = {};
    try {
      freqData = JSON.parse(schedule.frequency_data || '{}');
    } catch (e) {
      console.error(`Error parsing frequency_data for schedule ${schedule.id}:`, e);
      continue;
    }

    const tasksToInsert = [];

    for (const dateStr of datesToCheck) {
      const dateObj = new Date(dateStr + 'T00:00:00');
      const dayOfWeek = dateObj.getDay(); // 0 (Sun) - 6 (Sat)
      const dayOfMonth = dateObj.getDate();
      const month = dateObj.getMonth() + 1; // 1 - 12

      let shouldSpawn = false;

      if (schedule.frequency === 'weekly') {
        const days = freqData.days || [];
        if (days.includes(dayOfWeek)) {
          shouldSpawn = true;
        }
      } else if (schedule.frequency === 'monthly') {
        const targetDay = freqData.day || 1;
        if (dayOfMonth === targetDay) {
          shouldSpawn = true;
        }
      } else if (schedule.frequency === 'yearly') {
        const targetMonth = freqData.month || 1;
        const targetDay = freqData.day || 1;
        if (month === targetMonth && dayOfMonth === targetDay) {
          shouldSpawn = true;
        }
      }

      if (shouldSpawn) {
        tasksToInsert.push({
          title: schedule.title,
          mode: schedule.mode,
          completed: 0,
          completed_at: null,
          created_at: `${dateStr}T00:00:00.000Z`,
          someday: schedule.someday,
          schedule_id: schedule.id,
          tags: schedule.tags
        });
      }
    }

    // Insert any spawned tasks
    if (tasksToInsert.length > 0) {
      for (const t of tasksToInsert) {
        await db.run(
          `INSERT INTO tasks (title, mode, completed, completed_at, created_at, someday, schedule_id, tags)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [t.title, t.mode, t.completed, t.completed_at, t.created_at, t.someday, t.schedule_id, t.tags]
        );
      }
    }

    // Update last_spawned_date for the schedule
    await db.run(
      'UPDATE schedules SET last_spawned_date = ? WHERE id = ?',
      [todayStr, schedule.id]
    );
  }
}
