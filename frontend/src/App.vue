<template>
  <div class="app-container" ref="appWrapper">

    <!-- Desktop Mode Switcher (Tab Style) -->
    <!-- <div class="mode-tabs">
      <div 
        class="mode-tab"
        :class="{ 'active-mode': currentMode === 'home' }"
        @click="setMode('home')"
      >
        <span class="tab-text">HOME</span>
      </div>
      <div 
        class="mode-tab"
        :class="{ 'active-mode': currentMode === 'work' }"
        @click="setMode('work')"
      >
        <span class="tab-text">WORK</span>
      </div>
    </div> -->

    <!-- Quick Task Entry -->
    <TaskInput 
      :current-mode="currentMode"
      :is-freshservice-enabled="isFreshserviceEnabled"
      @create-task="handleCreateTask"
      @create-schedule="handleCreateSchedule"
      @toggle-advanced="isAdvancedOpen = $event"
    />

    <!-- Navigation Tabs -->
    <div class="view-tabs">
      <div 
        class="view-tab" 
        :class="{ 'active': activeTab === 'active' }"
        @click="activeTab = 'active'"
      >
        ACTIVE
      </div>
      <div 
        class="view-tab" 
        :class="{ 'active': activeTab === 'upcoming' }"
        @click="activeTab = 'upcoming'"
      >
        UPCOMING
      </div>
      <div 
        class="view-tab" 
        :class="{ 'active': activeTab === 'someday' }"
        @click="activeTab = 'someday'"
      >
        SOMEDAY
      </div>
      <div 
        class="view-tab" 
        :class="{ 'active': activeTab === 'completed' }"
        @click="activeTab = 'completed'"
      >
        WEEKLY COMPLETED
      </div>
      <div 
        class="view-tab" 
        :class="{ 'active': activeTab === 'schedules' }"
        @click="activeTab = 'schedules'"
      >
        SCHEDULES
      </div>
    </div>

    <!-- Main Views -->
    <main>
      <!-- Active View Toolbar (only for active tasks view) -->
      <div v-if="activeTab === 'active'" class="active-toolbar" style="justify-content: space-between;">
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <div 
            class="daily-counter" 
            :class="{ 'gold-tier': completedTodayCount >= 3 }"
          >
            <span>TODAY:</span>
            <strong>{{ completedTodayCount }}</strong>
          </div>
          <button 
            class="sort-toggle-btn active"
            @click="setMode(currentMode === 'home' ? 'work' : 'home')"
            title="Toggle between Home and Work modes"
          >
            {{ currentMode === 'home' ? '[HOME]' : '[WORK]' }}
          </button>
        </div>

        <!-- Sort Toggles -->
        <div class="sort-toggles" style="display: flex; gap: 0.5rem; align-items: center;">
          <button 
            v-if="currentMode === 'work' && isFreshserviceEnabled"
            class="sort-toggle-btn"
            :disabled="isPulling"
            @click="pullFreshserviceTickets"
          >
            {{ isPulling ? '[PULLING...]' : '[PULL FRESHSERVICE]' }}
          </button>
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="12" 
            height="12" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            stroke-width="2.5" 
            stroke-linecap="round" 
            stroke-linejoin="round" 
            style="color: var(--text-secondary); margin-left: 0.2rem; flex-shrink: 0;"
            title="Sort options"
          >
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
          </svg>
          <button 
            class="sort-toggle-btn"
            :class="{ 'active': sortBy === 'default' }"
            @click="setSortBy('default')"
          >
            DEFAULT
          </button>
          <button 
            class="sort-toggle-btn"
            :class="{ 'active': sortBy === 'created' }"
            @click="setSortBy('created')"
          >
            CREATED DATE
          </button>
        </div>
      </div>

      <!-- Active Tasks, Upcoming & Someday Lists -->
      <TaskList 
        v-if="activeTab === 'active' || activeTab === 'upcoming' || activeTab === 'someday'"
        :tasks="tasks"
        :current-mode="currentMode"
        :show-someday="activeTab === 'someday'"
        :show-upcoming="activeTab === 'upcoming'"
        :show-completed="false"
        :is-reorderable="activeTab === 'active' && sortBy === 'default'"
        :sort-by="activeTab === 'active' ? sortBy : 'default'"
        :is-freshservice-enabled="isFreshserviceEnabled"
        @update-task="handleUpdateTask"
        @delete-task="handleDeleteTask"
        @open-drawer="openDrawer"
        @reorder-tasks="handleReorderTasks"
        @sync-freshservice="pushTaskToFreshservice"
      />

      <!-- Completed View Toolbar (only for weekly completed view) -->
      <div v-else-if="activeTab === 'completed'" class="active-toolbar" style="justify-content: space-between;">
        <div class="week-navigation" style="display: flex; align-items: center; gap: 0.8rem;">
          <button 
            class="sort-toggle-btn"
            @click="completedWeekOffset++"
          >
            [<-] PREV WEEK
          </button>
          <span class="week-range-text" style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--text-primary); font-weight: bold;">
            {{ formatWeekRangeText }}
          </span>
          <button 
            class="sort-toggle-btn"
            :disabled="completedWeekOffset === 0"
            @click="completedWeekOffset--"
          >
            NEXT WEEK [->]
          </button>
        </div>
        <button 
          class="sort-toggle-btn"
          :disabled="filteredCompletedTasks.length === 0"
          @click="copyCompletedTasks"
        >
          {{ copied ? '[COPIED!]' : '[COPY COMPLETED]' }}
        </button>
      </div>

      <!-- Weekly Completed List -->
      <TaskList 
        v-if="activeTab === 'completed'"
        :tasks="tasks"
        :current-mode="currentMode"
        :show-someday="false"
        :show-completed="true"
        :completed-week-offset="completedWeekOffset"
        :is-freshservice-enabled="isFreshserviceEnabled"
        @update-task="handleUpdateTask"
        @delete-task="handleDeleteTask"
        @open-drawer="openDrawer"
        @sync-freshservice="pushTaskToFreshservice"
      />

      <!-- Recurring Schedules List -->
      <div v-else-if="activeTab === 'schedules'">
        <div v-if="filteredSchedules.length === 0" class="empty-state">
          <div class="empty-icon">>_</div>
          <p>No schedules configured for this mode. Create one using the input above!</p>
        </div>
        <div v-else>
          <div 
            v-for="sched in filteredSchedules" 
            :key="sched.id"
            class="task-item schedule-item-dashed"
            @click="openDrawer(sched)"
          >
            <div class="task-content-wrapper">
              <span class="cluster-icon">> </span>
              <span class="task-title">
                {{ cleanTitle(sched.title) }}
                <span class="schedule-recurrence-info">
                  ({{ formatRecurrenceText(sched) }})
                </span>
                <span v-for="tag in sched.tags" :key="tag" class="tag-badge">
                  {{ tag }}
                </span>
              </span>
            </div>
            
            <!-- Quick delete button -->
            <button 
              class="more-actions-btn btn-danger-text" 
              @click.stop="handleDeleteSchedule(sched.id)"
            >
              [X]
            </button>
          </div>
        </div>
      </div>
    </main>

    <!-- Mobile Swipe Visual Hint -->
    <!-- <div class="swipe-indicator">
      Swipe left/right to toggle modes
    </div> -->

    <!-- Edit Drawer -->
    <TaskDrawer 
      v-if="drawerItem" 
      :item="drawerItem"
      :is-freshservice-enabled="isFreshserviceEnabled"
      :freshservice-domain="freshserviceDomain"
      @close="closeDrawer"
      @save-task="handleSaveTask"
      @save-schedule="handleSaveSchedule"
      @delete-task="handleDeleteTask"
      @delete-schedule="handleDeleteSchedule"
    />

    <!-- Toast Overlays -->
    <ToastNotification :toasts="toasts" @close="removeToast" />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import TaskInput from './components/TaskInput.vue';
import TaskList from './components/TaskList.vue';
import TaskDrawer from './components/TaskDrawer.vue';
import ToastNotification from './components/ToastNotification.vue';

const tasks = ref([]);
const schedules = ref([]);
const currentMode = ref(localStorage.getItem('currentMode') || 'home');
const activeTab = ref('active'); // active, someday, completed, schedules
const drawerItem = ref(null);
const completedWeekOffset = ref(0);
const isFreshserviceEnabled = ref(false);
const isPulling = ref(false);
const isAdvancedOpen = ref(false);
const toasts = ref([]);
const freshserviceDomain = ref('');

function showToast(message, type = 'info', duration = 4000) {
  const id = Date.now() + Math.random();
  toasts.value.push({ id, message, type });
  setTimeout(() => {
    removeToast(id);
  }, duration);
}

function removeToast(id) {
  toasts.value = toasts.value.filter(t => t.id !== id);
}

// Reset completedWeekOffset when changing tabs
watch(activeTab, () => {
  completedWeekOffset.value = 0;
});

const currentWeekRange = computed(() => {
  const refDate = new Date();
  refDate.setDate(refDate.getDate() - (completedWeekOffset.value * 7));
  const day = refDate.getDay();
  const startDay = currentMode.value === 'home' ? 1 : 2;
  const daysToSubtract = (day - startDay + 7) % 7;
  
  const startOfWeek = new Date(refDate);
  startOfWeek.setDate(refDate.getDate() - daysToSubtract);
  startOfWeek.setHours(0, 0, 0, 0);
  
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  
  return { startOfWeek, endOfWeek };
});

const formatWeekRangeText = computed(() => {
  const { startOfWeek, endOfWeek } = currentWeekRange.value;
  const format = (d) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };
  return `${format(startOfWeek)} - ${format(endOfWeek)}`;
});

const filteredCompletedTasks = computed(() => {
  const { startOfWeek, endOfWeek } = currentWeekRange.value;
  return tasks.value.filter(task => {
    if (task.mode !== currentMode.value) return false;
    if (task.completed !== 1) return false;
    if (!task.completed_at) return false;
    const completedDate = new Date(task.completed_at);
    return completedDate >= startOfWeek && completedDate <= endOfWeek;
  });
});

const copied = ref(false);
let copiedTimeout = null;

function showCopiedFeedback() {
  copied.value = true;
  if (copiedTimeout) clearTimeout(copiedTimeout);
  copiedTimeout = setTimeout(() => {
    copied.value = false;
  }, 1500);
}

async function copyCompletedTasks() {
  const completedList = filteredCompletedTasks.value;
  if (completedList.length === 0) return;

  const htmlItems = completedList.map(task => {
    const tagText = (task.tags && task.tags.length > 0) ? ` <span style="color: var(--accent);">${task.tags[0]}</span>` : '';
    return `<li>${cleanTitle(task.title)}${tagText}</li>`;
  }).join('\n');
  const htmlContent = `<ul>\n${htmlItems}\n</ul>`;

  const plainItems = completedList.map(task => {
    const tagText = (task.tags && task.tags.length > 0) ? ` ${task.tags[0]}` : '';
    return `• ${cleanTitle(task.title)}${tagText}`;
  }).join('\n');

  if (navigator.clipboard && window.ClipboardItem) {
    try {
      const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
      const plainBlob = new Blob([plainItems], { type: 'text/plain' });
      
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': htmlBlob,
          'text/plain': plainBlob
        })
      ]);
      showCopiedFeedback();
      return;
    } catch (err) {
      console.error('Clipboard HTML copy failed, trying plain text fallback:', err);
      try {
        await navigator.clipboard.writeText(plainItems);
        showCopiedFeedback();
        return;
      } catch (fallbackErr) {
        console.error('Clipboard fallback copy failed:', fallbackErr);
      }
    }
  }

  // Fallback for insecure contexts (navigator.clipboard is undefined)
  try {
    const success = fallbackCopy(htmlContent, plainItems);
    if (success) {
      showCopiedFeedback();
    } else {
      alert('Copying is not supported on this browser or context.');
    }
  } catch (err) {
    console.error('Fallback copy failed:', err);
    alert('Failed to copy to clipboard.');
  }
}

function fallbackCopy(htmlContent, plainContent) {
  let success = false;
  const listener = (e) => {
    e.clipboardData.setData('text/html', htmlContent);
    e.clipboardData.setData('text/plain', plainContent);
    e.preventDefault();
    success = true;
  };
  document.addEventListener('copy', listener);
  
  const textArea = document.createElement('textarea');
  textArea.value = plainContent;
  textArea.style.position = 'fixed';
  textArea.style.left = '-9999px';
  textArea.style.top = '-9999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  
  try {
    document.execCommand('copy');
  } catch (err) {
    console.error('execCommand copy failed:', err);
  }
  
  document.body.removeChild(textArea);
  document.removeEventListener('copy', listener);
  return success;
}

const sortBy = ref(localStorage.getItem('sortBy') || 'default');
function setSortBy(mode) {
  sortBy.value = mode;
  localStorage.setItem('sortBy', mode);
}

const appWrapper = ref(null);

// Sync mode with body class for background transitions
function setMode(mode) {
  currentMode.value = mode;
  document.body.className = `mode-${mode}`;
  completedWeekOffset.value = 0;
  localStorage.setItem('currentMode', mode);
}

// Compute completed tasks today
const completedTodayCount = computed(() => {
  const todayStr = new Date().toLocaleDateString();
  return tasks.value.filter(task => {
    if (task.completed !== 1 || !task.completed_at) return false;
    // Check if task completed day matches local today
    const completedDay = new Date(task.completed_at).toLocaleDateString();
    return completedDay === todayStr;
  }).length;
});

// Filter schedules by current mode
const filteredSchedules = computed(() => {
  return schedules.value.filter(s => s.mode === currentMode.value);
});

// Human-readable schedule helper
function formatRecurrenceText(sched) {
  if (sched.frequency === 'weekly') {
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const days = sched.frequency_data?.days || [];
    const dayNames = days.map(d => weekdays[d]).join(', ');
    return `Weekly on ${dayNames}`;
  } else if (sched.frequency === 'monthly') {
    const day = sched.frequency_data?.day || 1;
    return `Monthly on day ${day}`;
  } else if (sched.frequency === 'yearly') {
    const month = sched.frequency_data?.month || 1;
    const day = sched.frequency_data?.day || 1;
    const date = new Date(2000, month - 1, day);
    const monthName = date.toLocaleString('default', { month: 'short' });
    return `Yearly on ${monthName} ${day}`;
  }
  return sched.frequency;
}

function cleanTitle(title) {
  if (!title) return '';
  return title.replace(/#[a-zA-Z0-9-_]+/g, '').replace(/\s+/g, ' ').trim();
}

// ---------------- DRAWER HANDLERS ----------------

function openDrawer(item) {
  drawerItem.value = item;
}

function closeDrawer() {
  drawerItem.value = null;
}

// ---------------- API SYNC HANDLERS ----------------

async function fetchData() {
  try {
    const tasksRes = await fetch('/api/tasks');
    tasks.value = await tasksRes.json();

    const schedulesRes = await fetch('/api/schedules');
    schedules.value = await schedulesRes.json();
  } catch (err) {
    console.error('Failed to sync with database:', err);
  }
}

async function handleCreateTask(taskData) {
  try {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(taskData)
    });
    const newTask = await res.json();
    tasks.value.push(newTask);
  } catch (err) {
    console.error('Error creating task:', err);
  }
}

async function handleCreateSchedule(scheduleData) {
  try {
    const res = await fetch('/api/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scheduleData)
    });
    const newSched = await res.json();
    schedules.value.push(newSched);
    // Refresh task list as creating a schedule might trigger a task spawn immediately
    await fetchData();
  } catch (err) {
    console.error('Error creating schedule:', err);
  }
}

async function handleUpdateTask(task) {
  // If the task was just starred (and wasn't starred before):
  const oldTask = tasks.value.find(t => t.id === task.id);
  if (oldTask && oldTask.starred === 0 && task.starred === 1) {
    // We want to bump it below existing starred items.
    const activeTasks = tasks.value.filter(t => t.mode === currentMode.value && t.someday === 0 && t.completed === 0);
    // Sort them such that starred go to the top, and our newly starred task goes at the end of the starred group.
    activeTasks.sort((a, b) => {
      const starredA = a.id === task.id ? 1 : (a.starred || 0);
      const starredB = b.id === task.id ? 1 : (b.starred || 0);
      if (starredA !== starredB) return starredB - starredA;
      
      if (starredA === 1) {
        if (a.id === task.id) return 1;
        if (b.id === task.id) return -1;
      }
      
      const orderA = a.sort_order || 0;
      const orderB = b.sort_order || 0;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(a.created_at) - new Date(b.created_at);
    });
    
    const orders = activeTasks.map((t, idx) => ({
      id: t.id,
      sort_order: idx + 1,
      starred: t.id === task.id ? 1 : (t.starred || 0)
    }));
    
    try {
      const res = await fetch('/api/tasks/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders })
      });
      if (res.ok) {
        await fetchData();
        return;
      }
    } catch (err) {
      console.error('Failed to star task and reorder:', err);
    }
  }

  // Standard update task
  try {
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task)
    });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Failed to update task');
    }
    const updated = await res.json();
    const idx = tasks.value.findIndex(t => t.id === updated.id);
    if (idx !== -1) {
      tasks.value[idx] = updated;
    }
  } catch (err) {
    console.error('Error updating task:', err);
    showToast(err.message, 'error');
    // Refresh to revert UI checkbox state
    await fetchData();
  }
}

async function handleReorderTasks(orders) {
  try {
    const res = await fetch('/api/tasks/reorder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orders })
    });
    if (res.ok) {
      await fetchData();
    }
  } catch (err) {
    console.error('Error reordering tasks:', err);
  }
}

async function handleSaveTask(task) {
  if (task.isRecurring) {
    try {
      // 1. Create a schedule first
      const schedRes = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: task.title,
          mode: task.mode,
          frequency: task.frequency,
          frequency_data: task.frequency_data,
          someday: task.someday
        })
      });
      const newSched = await schedRes.json();
      schedules.value.push(newSched);
      
      // 2. Link task to this schedule
      task.schedule_id = newSched.id;
    } catch (err) {
      console.error('Error creating schedule from task:', err);
    }
  }
  await handleUpdateTask(task);
  closeDrawer();
  await fetchData();
}

async function handleSaveSchedule(schedule) {
  try {
    const res = await fetch(`/api/schedules/${schedule.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(schedule)
    });
    const updated = await res.json();
    const idx = schedules.value.findIndex(s => s.id === updated.id);
    if (idx !== -1) {
      schedules.value[idx] = updated;
    }
    closeDrawer();
    // Refresh tasks since updating recurrence parameters might trigger a spawn check
    await fetchData();
  } catch (err) {
    console.error('Error saving schedule:', err);
  }
}

async function handleDeleteTask(taskId) {
  try {
    await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
    tasks.value = tasks.value.filter(t => t.id !== taskId);
    closeDrawer();
  } catch (err) {
    console.error('Error deleting task:', err);
  }
}

async function handleDeleteSchedule(scheduleId) {
  try {
    await fetch(`/api/schedules/${scheduleId}`, { method: 'DELETE' });
    schedules.value = schedules.value.filter(s => s.id !== scheduleId);
    closeDrawer();
  } catch (err) {
    console.error('Error deleting schedule:', err);
  }
}

// ---------------- TOUCH / SWIPE HANDLERS ----------------

let touchStartX = 0;
let touchStartY = 0;

function handleTouchStart(e) {
  touchStartX = e.changedTouches[0].screenX;
  touchStartY = e.changedTouches[0].screenY;
}

function handleTouchEnd(e) {
  // Ignore mode-switching swipes if the edit drawer is open
  if (drawerItem.value) return;

  const touchEndX = e.changedTouches[0].screenX;
  const touchEndY = e.changedTouches[0].screenY;
  
  const diffX = touchEndX - touchStartX;
  const diffY = touchEndY - touchStartY;

  // Swipe gesture threshold (horizontal swipe > vertical swipe, min 80px)
  if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 80) {
    setMode(currentMode.value === 'home' ? 'work' : 'home');
  }
}



function handleKeyDown(e) {
  if (e.key === 'Tab') {
    if (drawerItem.value || isAdvancedOpen.value) {
      return;
    }
    e.preventDefault();
    setMode(currentMode.value === 'home' ? 'work' : 'home');
  }
}

async function checkFreshserviceConfig() {
  try {
    const res = await fetch('/api/freshservice/config');
    const data = await res.json();
    isFreshserviceEnabled.value = data.enabled;
    freshserviceDomain.value = data.domain || '';
  } catch (err) {
    console.error('Failed to fetch Freshservice config:', err);
  }
}

async function pullFreshserviceTickets() {
  if (isPulling.value) return;
  isPulling.value = true;
  try {
    const res = await fetch('/api/freshservice/sync-pull', { method: 'POST' });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Failed to pull tickets');
    }
    const result = await res.json();
    await fetchData();
    showToast(`Successfully pulled ${result.newTasksCount} new and updated ${result.updatedTasksCount} tickets`, 'success');
  } catch (err) {
    console.error('Failed to pull from Freshservice:', err);
    showToast(`Sync failed: ${err.message}`, 'error');
  } finally {
    isPulling.value = false;
  }
}

async function pushTaskToFreshservice(taskId) {
  try {
    const res = await fetch(`/api/freshservice/sync-push/${taskId}`, { method: 'POST' });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Failed to sync ticket');
    }
    const result = await res.json();
    
    // Update local tasks array
    const idx = tasks.value.findIndex(t => t.id === result.task.id);
    if (idx !== -1) {
      tasks.value[idx] = result.task;
    }
    
    // Update drawerItem if open
    if (drawerItem.value && drawerItem.value.id === result.task.id) {
      drawerItem.value = result.task;
    }
    showToast('Task synced to Freshservice successfully', 'success');
  } catch (err) {
    console.error('Failed to push task to Freshservice:', err);
    showToast(`Sync failed: ${err.message}`, 'error');
  }
}

onMounted(() => {
  setMode(currentMode.value);
  fetchData();
  checkFreshserviceConfig();
  
  window.addEventListener('touchstart', handleTouchStart, { passive: true });
  window.addEventListener('touchend', handleTouchEnd, { passive: true });
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('touchstart', handleTouchStart);
  window.removeEventListener('touchend', handleTouchEnd);
  window.removeEventListener('keydown', handleKeyDown);
});
</script>
