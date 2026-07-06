<template>
  <div class="glass-panel" style="margin-bottom: 2rem;">
    <form @submit.prevent="handleSubmit">
      <div style="display: flex; gap: 0.75rem; align-items: center; width: 100%;">
        <div class="input-field-wrapper" style="flex: 1;">
          <span class="prompt-symbol">></span>
          <input
            ref="titleInput"
            v-model="title"
            type="text"
            placeholder=""
            class="input-field"
            required
            @keydown="handleKeydown"
          />
        </div>
        <button type="submit" class="btn-add-task" tabindex="-1">+</button>
        <button
          type="button"
          :class="['btn-options', { 'is-active': showAdvanced }]"
          @click="showAdvanced = !showAdvanced"
          title="Toggle Advanced Options"
          tabindex="-1"
        >
          ⚙
        </button>
      </div>

      <div v-if="showAdvanced" class="advanced-options-accordion">
        <div class="advanced-options-grid">
          <!-- Task Type Selection -->
          <div class="drawer-section">
            <label>Task Type</label>
            <select ref="taskTypeInput" v-model="taskType" class="select-field">
              <option value="once">One-time Task</option>
              <option value="recurring">Recurring Schedule</option>
            </select>
          </div>

          <!-- One-time Task Options -->
          <template v-if="taskType === 'once'">
            <div class="drawer-section">
              <label>Due Date</label>
              <input 
                ref="dateInput"
                type="date" 
                v-model="dueDate" 
                class="input-field" 
                @keydown.tab="handleDateTab"
              />
            </div>
            <div v-if="props.currentMode === 'work'" style="display: flex; gap: 0.6rem; width: 100%; align-items: flex-start; grid-column: span 2;">
              <div class="drawer-section" style="flex: 1; margin: 0;">
                <label>Due Time</label>
                <input 
                  ref="timeInput"
                  type="time" 
                  v-model="dueTime" 
                  class="input-field" 
                  @keydown.tab="handleTimeTab"
                />
              </div>
              <div v-if="isFreshserviceEnabled" class="drawer-section" style="flex: 2; margin: 0;">
                <label>Requester Email</label>
                <input 
                  ref="requesterInput"
                  type="email" 
                  v-model="requester" 
                  class="input-field" 
                  placeholder="requester@example.com" 
                  @keydown.tab="handleRequesterTab"
                />
              </div>
            </div>
            <div v-else class="drawer-section">
              <label>Due Time (optional)</label>
              <input 
                ref="timeInput"
                type="time" 
                v-model="dueTime" 
                class="input-field" 
                @keydown.tab="handleTimeTab"
              />
            </div>
            <div v-if="dueDate" class="drawer-section" style="display: flex; align-items: center; gap: 0.5rem; margin-top: 1.2rem;">
              <input 
                ref="keepActiveInput"
                type="checkbox" 
                id="input-keep-active" 
                v-model="keepActive" 
                class="cli-checkbox" 
                @keydown.tab="handleKeepActiveTab"
              />
              <label for="input-keep-active" style="cursor: pointer; user-select: none;">Keep Active</label>
            </div>
            <div class="drawer-section" style="grid-column: span 2;">
              <label>Task Notes</label>
              <textarea 
                ref="notesInput"
                v-model="notes" 
                class="input-field" 
                style="resize: vertical; min-height: 4rem;" 
                placeholder="Task notes..."
                @keydown.tab="handleNotesTab"
              ></textarea>
            </div>
          </template>

          <!-- Recurring Schedule Options -->
          <template v-else-if="taskType === 'recurring'">
            <div class="drawer-section">
              <label>Frequency</label>
              <select v-model="frequency" class="select-field">
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>

            <!-- Weekly options -->
            <div v-if="frequency === 'weekly'" class="drawer-section">
              <label>Repeat Days</label>
              <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; margin-top: 0.5rem;">
                <div v-for="d in weekdays" :key="d.val" style="display: flex; align-items: center; gap: 0.4rem;">
                  <input type="checkbox" :id="'input-day-' + d.val" :value="d.val" v-model="weeklyDays" class="cli-checkbox" />
                  <label :for="'input-day-' + d.val" style="font-size: 0.85rem; cursor: pointer; user-select: none;">{{ d.name }}</label>
                </div>
              </div>
            </div>

            <!-- Monthly options -->
            <div v-if="frequency === 'monthly'" class="drawer-section">
              <label>Day of Month</label>
              <input type="number" min="1" max="31" v-model.number="monthlyDay" class="input-field" />
            </div>

            <!-- Yearly options -->
            <div v-if="frequency === 'yearly'" class="drawer-section">
              <div style="display: flex; gap: 0.5rem;">
                <div style="flex: 1;">
                  <label>Month</label>
                  <select v-model.number="yearlyMonth" class="select-field">
                    <option v-for="m in 12" :key="m" :value="m">{{ getMonthName(m) }}</option>
                  </select>
                </div>
                <div style="width: 80px;">
                  <label>Day</label>
                  <input type="number" min="1" max="31" v-model.number="yearlyDay" class="input-field" />
                </div>
              </div>
            </div>
          </template>

        </div>
      </div>

    </form>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  currentMode: {
    type: String,
    required: true
  },
  isFreshserviceEnabled: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['create-task', 'create-schedule', 'toggle-advanced']);

const title = ref('');
const mode = ref(props.currentMode);
const someday = ref(false);
const showAdvanced = ref(false);

watch(showAdvanced, (newVal) => {
  emit('toggle-advanced', newVal);
});

function handleKeydown(e) {
  if (e.key === '\\') {
    e.preventDefault();
    showAdvanced.value = true;
  }
}

const taskType = ref('once');
const dueDate = ref('');
const dueTime = ref('');
const keepActive = ref(false);
const notes = ref('');
const requester = ref('');

const frequency = ref('weekly');

// Recurrence frequency data
const weeklyDays = ref([1]); // default Monday
const monthlyDay = ref(1);
const yearlyMonth = ref(1);
const yearlyDay = ref(1);

const weekdays = [
  { name: 'Mon', val: 1 },
  { name: 'Tue', val: 2 },
  { name: 'Wed', val: 3 },
  { name: 'Thu', val: 4 },
  { name: 'Fri', val: 5 },
  { name: 'Sat', val: 6 },
  { name: 'Sun', val: 0 }
];

const titleInput = ref(null);
const taskTypeInput = ref(null);
const dateInput = ref(null);
const timeInput = ref(null);
const requesterInput = ref(null);
const keepActiveInput = ref(null);
const notesInput = ref(null);

function handleDateTab(e) {
  e.preventDefault();
  if (e.shiftKey) {
    taskTypeInput.value?.focus();
  } else {
    timeInput.value?.focus();
  }
}

function handleTimeTab(e) {
  e.preventDefault();
  if (e.shiftKey) {
    dateInput.value?.focus();
  } else {
    if (props.currentMode === 'work' && props.isFreshserviceEnabled && requesterInput.value) {
      requesterInput.value.focus();
    } else if (dueDate.value && keepActiveInput.value) {
      keepActiveInput.value.focus();
    } else if (notesInput.value) {
      notesInput.value.focus();
    }
  }
}

function handleRequesterTab(e) {
  if (e.shiftKey) {
    e.preventDefault();
    timeInput.value?.focus();
  }
}

function handleKeepActiveTab(e) {
  if (e.shiftKey) {
    e.preventDefault();
    if (props.currentMode === 'work' && props.isFreshserviceEnabled && requesterInput.value) {
      requesterInput.value.focus();
    } else {
      timeInput.value?.focus();
    }
  }
}

function handleNotesTab(e) {
  if (e.shiftKey) {
    e.preventDefault();
    if (dueDate.value && keepActiveInput.value) {
      keepActiveInput.value.focus();
    } else if (props.currentMode === 'work' && props.isFreshserviceEnabled && requesterInput.value) {
      requesterInput.value.focus();
    } else {
      timeInput.value?.focus();
    }
  }
}

// Sync mode with prop
watch(() => props.currentMode, (newVal) => {
  mode.value = newVal;
});

function getMonthName(monthNum) {
  const date = new Date(2000, monthNum - 1, 1);
  return date.toLocaleString('default', { month: 'short' });
}

function handleSubmit() {
  if (!title.value.trim()) return;

  if (showAdvanced.value && taskType.value === 'recurring') {
    let freqData = {};
    if (frequency.value === 'weekly') {
      freqData = { days: weeklyDays.value };
    } else if (frequency.value === 'monthly') {
      freqData = { day: monthlyDay.value };
    } else if (frequency.value === 'yearly') {
      freqData = { month: yearlyMonth.value, day: yearlyDay.value };
    }

    emit('create-schedule', {
      title: title.value,
      mode: mode.value,
      frequency: frequency.value,
      frequency_data: freqData,
      someday: someday.value
    });
  } else {
    let combinedDueDate = null;
    if (showAdvanced.value && taskType.value === 'once' && dueDate.value) {
      combinedDueDate = dueTime.value ? `${dueDate.value} ${dueTime.value}` : dueDate.value;
    }

    emit('create-task', {
      title: title.value,
      mode: mode.value,
      someday: someday.value,
      due_date: combinedDueDate,
      keep_active: (showAdvanced.value && taskType.value === 'once' && keepActive.value) ? 1 : 0,
      notes: (showAdvanced.value && taskType.value === 'once' && notes.value.trim()) ? notes.value.trim() : null,
      is_freshservice: 0,
      resolution_notes: null,
      requester: (showAdvanced.value && taskType.value === 'once' && props.currentMode === 'work' && requester.value.trim()) ? requester.value.trim() : null
    });
  }

  // Reset form
  title.value = '';
  someday.value = false;
  showAdvanced.value = false;
  taskType.value = 'once';
  dueDate.value = '';
  dueTime.value = '';
  keepActive.value = false;
  notes.value = '';
  requester.value = '';
  weeklyDays.value = [1];
  monthlyDay.value = 1;
  yearlyMonth.value = 1;
  yearlyDay.value = 1;
}
</script>
