<template>
  <div>
    <!-- Backdrop -->
    <div class="drawer-backdrop" @click="$emit('close')"></div>
    
    <!-- Drawer Panel -->
    <div class="task-drawer">
      <div class="drawer-header">
        <h3>{{ isSchedule ? 'Edit Schedule' : 'Edit Task Details' }}</h3>
        <button class="drawer-close-btn" @click="$emit('close')">×</button>
      </div>

      <!-- Task/Schedule Title -->
      <div class="drawer-section">
        <label>Title</label>
        <input 
          v-model="editTitle" 
          type="text" 
          class="input-field" 
          placeholder="Task title..." 
          required 
        />
      </div>

      <!-- Mode selection -->
      <div class="drawer-section">
        <label>Mode</label>
        <div style="display: flex; gap: 0.4rem;">
          <button 
            type="button" 
            class="mode-toggle-btn"
            style="flex: 1;"
            :class="{ 'active-mode': editMode === 'home' }"
            @click="editMode = 'home'"
          >
            HOME
          </button>
          <button 
            type="button" 
            class="mode-toggle-btn"
            style="flex: 1;"
            :class="{ 'active-mode': editMode === 'work' }"
            @click="editMode = 'work'"
          >
            WORK
          </button>
        </div>
      </div>

      <!-- Tags & Someday Row -->
      <div style="display: flex; gap: 0.75rem; align-items: flex-end; width: 100%;">
        <!-- Tags Input -->
        <div class="drawer-section" style="flex: 1; margin: 0;">
          <label>Tag #project</label>
          <input 
            v-model="editTagsString" 
            type="text" 
            class="input-field" 
          />
        </div>

        <!-- Someday Toggle Button -->
        <button
          ref="somedayBtn"
          type="button"
          class="mode-toggle-btn"
          :class="{ 'active-mode': editSomeday }"
          style="height: 2.45rem; flex-shrink: 0;"
          @click="editSomeday = !editSomeday"
        >
          SOMEDAY
        </button>
      </div>

      <!-- Keep Active Toggle (Task only) -->
      <div v-if="!isSchedule && editDueDateOnly" class="drawer-section" style="flex-direction: row; align-items: center; gap: 0.5rem;">
        <input ref="keepActiveInput" type="checkbox" id="editKeepActive" v-model="editKeepActive" class="cli-checkbox" @keydown.tab="handleKeepActiveTab" />
        <label for="editKeepActive" style="cursor: pointer; user-select: none;">Keep Active</label>
      </div>

      <!-- Due Date & Time Row (Task only) -->
      <div v-if="!isSchedule" style="display: flex; gap: 0.75rem; align-items: flex-start; width: 100%;">
        <div class="drawer-section" style="flex: 1; margin: 0;">
          <label>Due Date</label>
          <input 
            ref="dateInput"
            v-model="editDueDateOnly" 
            type="date" 
            class="input-field" 
            @keydown.tab="handleDateTab"
          />
        </div>

        <div class="drawer-section" style="flex: 1; margin: 0;">
          <label>Due Time (optional)</label>
          <input 
            ref="timeInput"
            v-model="editDueTime" 
            type="time" 
            class="input-field" 
            @keydown.tab="handleTimeTab"
          />
        </div>

        <div v-if="editMode === 'work' && isFreshserviceEnabled" class="drawer-section" style="flex: 2; margin: 0;">
          <label>Requester Email</label>
          <input 
            ref="requesterInput"
            v-model="editRequester" 
            type="email" 
            class="input-field" 
            placeholder="requester@example.com" 
            @keydown.tab="handleRequesterTab"
          />
        </div>
      </div>

      <!-- Task Notes (Task only) -->
      <div v-if="!isSchedule" class="drawer-section">
        <label>Task Notes</label>
        <div class="notes-editor-container">
          <div class="editor-toolbar">
            <button 
              type="button" 
              class="toolbar-btn" 
              :class="{ 'is-active': editor && editor.isActive('bold') }"
              tabindex="-1"
              @click="editor?.chain().focus().toggleBold().run()"
            >
              [B]
            </button>
            <button 
              type="button" 
              class="toolbar-btn" 
              :class="{ 'is-active': editor && editor.isActive('italic') }"
              tabindex="-1"
              @click="editor?.chain().focus().toggleItalic().run()"
            >
              [I]
            </button>
            <button 
              type="button" 
              class="toolbar-btn" 
              :class="{ 'is-active': editor && editor.isActive('bulletList') }"
              tabindex="-1"
              @click="editor?.chain().focus().toggleBulletList().run()"
            >
              [• LIST]
            </button>
            <button 
              type="button" 
              class="toolbar-btn" 
              :class="{ 'is-active': editor && editor.isActive('orderedList') }"
              tabindex="-1"
              @click="editor?.chain().focus().toggleOrderedList().run()"
            >
              [1. LIST]
            </button>
            <button 
              type="button" 
              class="toolbar-btn" 
              :class="{ 'is-active': editor && editor.isActive('link') }"
              tabindex="-1"
              @click="setLink"
            >
              [LINK]
            </button>
            <button 
              v-if="editor && editor.isActive('link')"
              type="button" 
              class="toolbar-btn" 
              tabindex="-1"
              @click="editor?.chain().focus().unsetLink().run()"
            >
              [UNLINK]
            </button>
          </div>
          <editor-content :editor="editor" class="notes-editor" />
        </div>
      </div>

      <!-- Freshservice integration fields (Work mode only) -->
      <template v-if="!isSchedule && editMode === 'work' && isFreshserviceEnabled && editIsFreshservice">
        <div class="drawer-section" style="border-top: 1px solid var(--border-color); padding-top: 1rem; margin-top: 0.5rem;">
          <label>Resolution Notes</label>
          <textarea 
            v-model="editResolutionNotes" 
            class="input-field" 
            style="resize: vertical; min-height: 4rem;"
            placeholder="Resolution notes..."
          ></textarea>
        </div>

        <div v-if="item.freshservice_ticket_id" style="font-size: 0.8rem; color: var(--text-secondary); background: var(--bg-app); padding: 0.6rem; border-radius: 4px; border: 1px solid var(--border-color); margin-top: 0.5rem;">
          Freshservice Ticket: 
          <a 
            :href="`https://${freshserviceDomain}/a/tickets/${item.freshservice_ticket_id}`" 
            target="_blank" 
            class="ticket-link"
          >
            #{{ item.freshservice_ticket_id }}
          </a>
        </div>
      </template>

      <!-- Option to turn normal task into recurring schedule -->
      <div v-if="!isSchedule && !item.schedule_id && !editIsFreshservice" class="drawer-section" style="flex-direction: row; align-items: center; gap: 0.5rem; border-top: 1px solid var(--border-color); padding-top: 1rem; margin-top: 0.5rem;">
        <input type="checkbox" id="enableRecurrence" v-model="enableRecurrence" class="cli-checkbox" />
        <label for="enableRecurrence" style="font-weight: bold; cursor: pointer; user-select: none;">Enable Recurrence</label>
      </div>

      <!-- Conditional fields for Schedule editing or if Task recurrence is enabled -->
      <div v-if="isSchedule || (enableRecurrence && !item.schedule_id)" style="border-top: 1px solid var(--border-color); padding-top: 1.5rem; display: flex; flex-direction: column; gap: 1.5rem;">
        <h4>Recurrence Rule</h4>
        
        <div class="drawer-section">
          <label>Frequency</label>
          <select v-model="editFrequency" class="select-field">
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>

        <!-- Weekly days check -->
        <div v-if="editFrequency === 'weekly'" class="drawer-section">
          <label>Repeat Days</label>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; margin-top: 0.5rem;">
            <div v-for="d in weekdays" :key="d.val" style="display: flex; align-items: center; gap: 0.4rem;">
              <input type="checkbox" :id="'edit-day-' + d.val" :value="d.val" v-model="editWeeklyDays" class="cli-checkbox" />
              <label :for="'edit-day-' + d.val" style="font-size: 0.85rem; cursor: pointer; user-select: none;">{{ d.name }}</label>
            </div>
          </div>
        </div>

        <!-- Monthly day input -->
        <div v-if="editFrequency === 'monthly'" class="drawer-section">
          <label>Day of Month</label>
          <input 
            type="number" 
            min="1" 
            max="31" 
            v-model.number="editMonthlyDay" 
            class="input-field" 
          />
        </div>

        <!-- Yearly month/day inputs -->
        <div v-if="editFrequency === 'yearly'" class="drawer-section">
          <div style="display: flex; gap: 0.5rem;">
            <div style="flex: 1;">
              <label>Month</label>
              <select v-model.number="editYearlyMonth" class="select-field">
                <option v-for="m in 12" :key="m" :value="m">{{ getMonthName(m) }}</option>
              </select>
            </div>
            <div style="width: 100px;">
              <label>Day</label>
              <input 
                type="number" 
                min="1" 
                max="31" 
                v-model.number="editYearlyDay" 
                class="input-field" 
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Info about Schedule if spawned task -->
      <div v-else-if="item.schedule_id" style="font-size: 0.8rem; color: var(--text-secondary); background: var(--bg-app); padding: 0.6rem; border-radius: 4px; border: 1px solid var(--border-color);">
        Generated automatically by a recurring schedule template.
      </div>

      <!-- Actions Footer -->
      <div class="drawer-footer">
        <button 
          class="btn-primary" 
          style="flex: 1;" 
          @click="saveChanges"
        >
          Save Changes
        </button>
        <button 
          class="btn-secondary" 
          style="border-color: var(--color-danger); color: var(--color-danger); background: var(--color-danger-glow);" 
          @click="deleteItem"
        >
          Delete
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onBeforeUnmount } from 'vue';
import { useEditor, EditorContent } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';

const props = defineProps({
  item: {
    type: Object,
    required: true
  },
  isFreshserviceEnabled: {
    type: Boolean,
    default: false
  },
  freshserviceDomain: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['close', 'save-task', 'save-schedule', 'delete-task', 'delete-schedule']);

const somedayBtn = ref(null);
const keepActiveInput = ref(null);
const dateInput = ref(null);
const timeInput = ref(null);
const requesterInput = ref(null);

function handleKeepActiveTab(e) {
  if (e.shiftKey) {
    e.preventDefault();
    somedayBtn.value?.focus();
  }
}

function handleDateTab(e) {
  e.preventDefault();
  if (e.shiftKey) {
    if (keepActiveInput.value) {
      keepActiveInput.value.focus();
    } else {
      somedayBtn.value?.focus();
    }
  } else {
    timeInput.value?.focus();
  }
}

function handleTimeTab(e) {
  e.preventDefault();
  if (e.shiftKey) {
    dateInput.value?.focus();
  } else {
    if (editMode.value === 'work' && props.isFreshserviceEnabled && requesterInput.value) {
      requesterInput.value.focus();
    } else {
      editor.value?.commands.focus();
    }
  }
}

function handleRequesterTab(e) {
  if (e.shiftKey) {
    e.preventDefault();
    timeInput.value?.focus();
  } else {
    e.preventDefault();
    editor.value?.commands.focus();
  }
}

// Determine if we are editing a Schedule or a Task
const isSchedule = computed(() => props.item.frequency !== undefined);
const enableRecurrence = ref(false);

// Local state initialized with item values
const editTitle = ref(props.item.title);
const editMode = ref(props.item.mode);
const editSomeday = ref(props.item.someday === 1);
const editTagsString = ref(props.item.tags ? props.item.tags.join(', ') : '');

// Parse initial due_date (YYYY-MM-DD or YYYY-MM-DD HH:MM)
const initialDueDate = props.item.due_date || '';
const editDueDateOnly = ref(initialDueDate ? initialDueDate.split(' ')[0] : '');
const editDueTime = ref((initialDueDate && initialDueDate.includes(' ')) ? initialDueDate.split(' ')[1] : '');
const editKeepActive = ref(props.item.keep_active === 1);
const editNotes = ref(props.item.notes || '');
const editIsFreshservice = ref(props.item.is_freshservice === 1);
const editResolutionNotes = ref(props.item.resolution_notes || '');
const editRequester = ref(props.item.requester || '');

const editor = useEditor({
  content: editNotes.value,
  extensions: [
    StarterKit,
    Link.configure({
      openOnClick: false,
      autolink: true,
      HTMLAttributes: {
        target: '_blank',
        rel: 'noopener noreferrer',
        class: 'ticket-link'
      }
    })
  ],
  onUpdate: ({ editor }) => {
    editNotes.value = editor.getHTML();
  }
});

function setLink() {
  const previousUrl = editor.value?.getAttributes('link').href;
  const url = window.prompt('URL', previousUrl);

  if (url === null) {
    return;
  }

  if (url === '') {
    editor.value?.chain().focus().extendMarkRange('link').unsetLink().run();
    return;
  }

  editor.value?.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
}

onBeforeUnmount(() => {
  if (editor.value) {
    editor.value.destroy();
  }
});

// Schedule frequency fields
const editFrequency = ref(props.item.frequency || 'weekly');
const editWeeklyDays = ref(props.item.frequency_data?.days || [1]);
const editMonthlyDay = ref(props.item.frequency_data?.day || 1);
const editYearlyMonth = ref(props.item.frequency_data?.month || 1);
const editYearlyDay = ref(props.item.frequency_data?.day || 1);

const weekdays = [
  { name: 'Mon', val: 1 },
  { name: 'Tue', val: 2 },
  { name: 'Wed', val: 3 },
  { name: 'Thu', val: 4 },
  { name: 'Fri', val: 5 },
  { name: 'Sat', val: 6 },
  { name: 'Sun', val: 0 }
];

const getMonthName = (monthNum) => {
  const date = new Date(2000, monthNum - 1, 1);
  return date.toLocaleString('default', { month: 'short' });
}

// Normalizes input tag string to JSON array
function parseTags(tagStr) {
  if (!tagStr) return [];
  const parsed = tagStr
    .split(',')
    .map(t => t.trim())
    .filter(t => t.length > 0)
    .map(t => t.startsWith('#') ? t.toLowerCase() : `#${t.toLowerCase()}`);
  return parsed.length > 0 ? [parsed[parsed.length - 1]] : [];
}

function saveChanges() {
  if (!editTitle.value.trim()) return;

  const parsedTags = parseTags(editTagsString.value);

  if (isSchedule.value) {
    let freqData = {};
    if (editFrequency.value === 'weekly') {
      freqData = { days: editWeeklyDays.value };
    } else if (editFrequency.value === 'monthly') {
      freqData = { day: editMonthlyDay.value };
    } else if (editFrequency.value === 'yearly') {
      freqData = { month: editYearlyMonth.value, day: editYearlyDay.value };
    }

    emit('save-schedule', {
      ...props.item,
      title: editTitle.value,
      mode: editMode.value,
      tags: parsedTags,
      someday: editSomeday.value ? 1 : 0,
      frequency: editFrequency.value,
      frequency_data: freqData
    });
  } else {
    let combinedDueDate = null;
    if (editDueDateOnly.value) {
      combinedDueDate = editDueTime.value ? `${editDueDateOnly.value} ${editDueTime.value}` : editDueDateOnly.value;
    }

    const payload = {
      ...props.item,
      title: editTitle.value,
      mode: editMode.value,
      tags: parsedTags,
      someday: editSomeday.value ? 1 : 0,
      due_date: combinedDueDate,
      keep_active: editKeepActive.value ? 1 : 0,
      notes: (editor.value && !editor.value.isEmpty) ? editNotes.value.trim() : null,
      is_freshservice: editMode.value === 'work' && editIsFreshservice.value ? 1 : 0,
      resolution_notes: editMode.value === 'work' && editIsFreshservice.value && editResolutionNotes.value.trim() ? editResolutionNotes.value.trim() : null,
      requester: editMode.value === 'work' && editIsFreshservice.value && editRequester.value.trim() ? editRequester.value.trim() : null
    };

    if (enableRecurrence.value && !props.item.schedule_id) {
      payload.isRecurring = true;
      payload.frequency = editFrequency.value;

      let freqData = {};
      if (editFrequency.value === 'weekly') {
        freqData = { days: editWeeklyDays.value };
      } else if (editFrequency.value === 'monthly') {
        freqData = { day: editMonthlyDay.value };
      } else if (editFrequency.value === 'yearly') {
        freqData = { month: editYearlyMonth.value, day: editYearlyDay.value };
      }
      payload.frequency_data = freqData;
    }

    emit('save-task', payload);
  }
}

function deleteItem() {
  if (isSchedule.value) {
    emit('delete-schedule', props.item.id);
  } else {
    emit('delete-task', props.item.id);
  }
}
</script>

<style scoped>
.notes-editor-container {
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-input);
  display: flex;
  flex-direction: column;
}
.notes-editor-container:focus-within {
  border-color: var(--accent);
}
.editor-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem;
  padding: 0.4rem;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-surface);
}
.toolbar-btn {
  background: none;
  border: none;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0.1rem 0.4rem;
  border-radius: 2px;
}
.toolbar-btn:hover {
  color: var(--text-primary);
}
.toolbar-btn.is-active {
  color: var(--accent);
  font-weight: bold;
}
.notes-editor :deep(.ProseMirror) {
  min-height: 8rem;
  max-height: 20rem;
  overflow-y: auto;
  padding: 0.8rem;
  outline: none;
  font-family: inherit;
  font-size: 0.9rem;
  color: var(--text-primary);
  word-break: break-word;
}
.notes-editor :deep(.ProseMirror p) {
  margin-bottom: 0.8rem;
}
.notes-editor :deep(.ProseMirror p:last-child) {
  margin-bottom: 0;
}
.notes-editor :deep(.ProseMirror ul), 
.notes-editor :deep(.ProseMirror ol) {
  margin-left: 1.5rem;
  margin-bottom: 0.8rem;
}
.notes-editor :deep(.ProseMirror ul) {
  list-style-type: disc;
}
.notes-editor :deep(.ProseMirror ol) {
  list-style-type: decimal;
}
.notes-editor :deep(.ProseMirror a) {
  color: var(--accent);
  text-decoration: underline;
  cursor: pointer;
}
.ticket-link {
  color: var(--accent);
  text-decoration: underline;
  cursor: pointer;
}
.ticket-link:hover {
  color: var(--accent-secondary);
}
</style>
