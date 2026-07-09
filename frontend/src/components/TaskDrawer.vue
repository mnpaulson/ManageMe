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
        <label>Task Body</label>
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

      <!-- Additional Notes (Task only) -->
      <div v-if="!isSchedule" class="drawer-section" style="border-top: 1px solid var(--border-color); padding-top: 1rem; margin-top: 1rem;">
        <label>Additional Notes</label>
        
        <!-- New Note Editor Form -->
        <div class="additional-note-form" style="margin-bottom: 1rem;">
          <div class="notes-editor-container">
            <div class="editor-toolbar">
              <button 
                type="button" 
                class="toolbar-btn" 
                :class="{ 'is-active': newNoteEditor && newNoteEditor.isActive('bold') }"
                tabindex="-1"
                @click="newNoteEditor?.chain().focus().toggleBold().run()"
              >
                [B]
              </button>
              <button 
                type="button" 
                class="toolbar-btn" 
                :class="{ 'is-active': newNoteEditor && newNoteEditor.isActive('italic') }"
                tabindex="-1"
                @click="newNoteEditor?.chain().focus().toggleItalic().run()"
              >
                [I]
              </button>
              <button 
                type="button" 
                class="toolbar-btn" 
                :class="{ 'is-active': newNoteEditor && newNoteEditor.isActive('bulletList') }"
                tabindex="-1"
                @click="newNoteEditor?.chain().focus().toggleBulletList().run()"
              >
                [• LIST]
              </button>
              <button 
                type="button" 
                class="toolbar-btn" 
                :class="{ 'is-active': newNoteEditor && newNoteEditor.isActive('orderedList') }"
                tabindex="-1"
                @click="newNoteEditor?.chain().focus().toggleOrderedList().run()"
              >
                [1. LIST]
              </button>
              <button 
                type="button" 
                class="toolbar-btn" 
                :class="{ 'is-active': newNoteEditor && newNoteEditor.isActive('link') }"
                tabindex="-1"
                @click="setNewNoteLink"
              >
                [LINK]
              </button>
              <button 
                v-if="newNoteEditor && newNoteEditor.isActive('link')"
                type="button" 
                class="toolbar-btn" 
                tabindex="-1"
                @click="newNoteEditor?.chain().focus().unsetLink().run()"
              >
                [UNLINK]
              </button>
            </div>
            <editor-content :editor="newNoteEditor" class="notes-editor" />
          </div>
          <button 
            type="button" 
            class="btn-primary" 
            style="margin-top: 0.5rem; width: 100%; font-family: var(--font-mono); font-size: 0.85rem;" 
            :disabled="isNewNoteEmpty" 
            @click="addAdditionalNote"
          >
            [ADD NOTE]
          </button>
        </div>

        <!-- Additional Notes List -->
        <div class="additional-notes-list" style="display: flex; flex-direction: column; gap: 0.75rem; margin-top: 0.5rem;">
          <div v-if="additionalNotes.length === 0" class="empty-notes" style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-secondary); text-align: center; padding: 0.5rem; border: 1px dashed var(--border-color);">
            No additional notes.
          </div>
          <div 
            v-for="note in additionalNotes" 
            :key="note.id" 
            class="additional-note-item"
          >
            <!-- Monospace Header: Timestamp and actions -->
            <div class="note-item-header">
              <span>{{ formatTimestamp(note.created_at) }}</span>
              <div style="display: flex; gap: 0.5rem;">
                <button 
                  v-if="editingNoteId !== note.id"
                  type="button" 
                  class="toolbar-btn" 
                  style="padding: 0; color: var(--accent);" 
                  @click="startEditingNote(note)"
                >
                  [EDIT]
                </button>
                <button 
                  v-if="editingNoteId !== note.id"
                  type="button" 
                  class="toolbar-btn" 
                  style="padding: 0; color: var(--color-danger);" 
                  @click="deleteAdditionalNote(note.id)"
                >
                  [DELETE]
                </button>
              </div>
            </div>

            <!-- Preview / Edit State -->
            <div v-if="editingNoteId === note.id" class="note-item-edit-container">
              <div class="notes-editor-container">
                <div class="editor-toolbar">
                  <button 
                    type="button" 
                    class="toolbar-btn" 
                    :class="{ 'is-active': activeNoteEditor && activeNoteEditor.isActive('bold') }"
                    tabindex="-1"
                    @click="activeNoteEditor?.chain().focus().toggleBold().run()"
                  >
                    [B]
                  </button>
                  <button 
                    type="button" 
                    class="toolbar-btn" 
                    :class="{ 'is-active': activeNoteEditor && activeNoteEditor.isActive('italic') }"
                    tabindex="-1"
                    @click="activeNoteEditor?.chain().focus().toggleItalic().run()"
                  >
                    [I]
                  </button>
                  <button 
                    type="button" 
                    class="toolbar-btn" 
                    :class="{ 'is-active': activeNoteEditor && activeNoteEditor.isActive('bulletList') }"
                    tabindex="-1"
                    @click="activeNoteEditor?.chain().focus().toggleBulletList().run()"
                  >
                    [• LIST]
                  </button>
                  <button 
                    type="button" 
                    class="toolbar-btn" 
                    :class="{ 'is-active': activeNoteEditor && activeNoteEditor.isActive('orderedList') }"
                    tabindex="-1"
                    @click="activeNoteEditor?.chain().focus().toggleOrderedList().run()"
                  >
                    [1. LIST]
                  </button>
                  <button 
                    type="button" 
                    class="toolbar-btn" 
                    :class="{ 'is-active': activeNoteEditor && activeNoteEditor.isActive('link') }"
                    tabindex="-1"
                    @click="setActiveNoteLink"
                  >
                    [LINK]
                  </button>
                  <button 
                    v-if="activeNoteEditor && activeNoteEditor.isActive('link')"
                    type="button" 
                    class="toolbar-btn" 
                    tabindex="-1"
                    @click="activeNoteEditor?.chain().focus().unsetLink().run()"
                  >
                    [UNLINK]
                  </button>
                </div>
                <editor-content :editor="activeNoteEditor" class="notes-editor" />
              </div>
              <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
                <button 
                  type="button" 
                  class="btn-primary" 
                  style="flex: 1; font-size: 0.8rem; padding: 0.3rem 0.6rem; font-family: var(--font-mono);" 
                  @click="saveNoteEdit"
                >
                  [SAVE]
                </button>
                <button 
                  type="button" 
                  class="btn-secondary" 
                  style="flex: 1; font-size: 0.8rem; padding: 0.3rem 0.6rem; font-family: var(--font-mono);" 
                  @click="cancelEditingNote"
                >
                  [CANCEL]
                </button>
              </div>
            </div>
            <div 
              v-else 
              class="additional-note-content" 
              style="font-size: 0.85rem; color: var(--text-primary); line-height: 1.4; padding-top: 0.25rem;"
              v-html="note.content"
            ></div>
          </div>
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
import { ref, computed, onBeforeUnmount, watch } from 'vue';
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

const emit = defineEmits(['close', 'save-task', 'save-schedule', 'delete-task', 'delete-schedule', 'show-toast']);

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

// Additional Notes State and Handlers
const additionalNotes = ref([]);
const editingNoteId = ref(null);
const newNoteContent = ref('');

const newNoteEditor = useEditor({
  content: '',
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
    newNoteContent.value = editor.getHTML();
  }
});

const isNewNoteEmpty = computed(() => {
  return !newNoteEditor.value || newNoteEditor.value.isEmpty;
});

const activeNoteContent = ref('');
const activeNoteEditor = useEditor({
  content: '',
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
    activeNoteContent.value = editor.getHTML();
  }
});

function setNewNoteLink() {
  const previousUrl = newNoteEditor.value?.getAttributes('link').href;
  const url = window.prompt('URL', previousUrl);
  if (url === null) return;
  if (url === '') {
    newNoteEditor.value?.chain().focus().extendMarkRange('link').unsetLink().run();
    return;
  }
  newNoteEditor.value?.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
}

function setActiveNoteLink() {
  const previousUrl = activeNoteEditor.value?.getAttributes('link').href;
  const url = window.prompt('URL', previousUrl);
  if (url === null) return;
  if (url === '') {
    activeNoteEditor.value?.chain().focus().extendMarkRange('link').unsetLink().run();
    return;
  }
  activeNoteEditor.value?.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
}

async function fetchAdditionalNotes() {
  if (isSchedule.value || !props.item.id) {
    additionalNotes.value = [];
    return;
  }
  try {
    const res = await fetch(`/api/tasks/${props.item.id}/notes`);
    if (res.ok) {
      additionalNotes.value = await res.json();
    }
  } catch (err) {
    console.error('Failed to fetch additional notes:', err);
  }
}

watch(() => props.item.id, () => {
  fetchAdditionalNotes();
  editingNoteId.value = null;
  newNoteEditor.value?.commands.setContent('');
}, { immediate: true });

async function addAdditionalNote() {
  if (isNewNoteEmpty.value) return;
  try {
    const res = await fetch(`/api/tasks/${props.item.id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newNoteContent.value })
    });
    if (res.ok) {
      const newNote = await res.json();
      additionalNotes.value.unshift(newNote);
      newNoteEditor.value?.commands.setContent('');
      emit('show-toast', 'Note added successfully', 'success');
    } else {
      const err = await res.json();
      emit('show-toast', err.error || 'Failed to add note', 'error');
    }
  } catch (err) {
    console.error('Error adding note:', err);
    emit('show-toast', 'Error adding note', 'error');
  }
}

function startEditingNote(note) {
  editingNoteId.value = note.id;
  activeNoteContent.value = note.content;
  activeNoteEditor.value?.commands.setContent(note.content);
}

function cancelEditingNote() {
  editingNoteId.value = null;
}

async function saveNoteEdit() {
  if (!editingNoteId.value) return;
  try {
    const res = await fetch(`/api/tasks/${props.item.id}/notes/${editingNoteId.value}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: activeNoteContent.value })
    });
    if (res.ok) {
      const updatedNote = await res.json();
      const idx = additionalNotes.value.findIndex(n => n.id === updatedNote.id);
      if (idx !== -1) {
        additionalNotes.value[idx] = updatedNote;
      }
      editingNoteId.value = null;
      emit('show-toast', 'Note updated successfully', 'success');
    } else {
      const err = await res.json();
      emit('show-toast', err.error || 'Failed to update note', 'error');
    }
  } catch (err) {
    console.error('Error updating note:', err);
    emit('show-toast', 'Error updating note', 'error');
  }
}

async function deleteAdditionalNote(noteId) {
  if (!window.confirm('Are you sure you want to delete this note?')) return;
  try {
    const res = await fetch(`/api/tasks/${props.item.id}/notes/${noteId}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      additionalNotes.value = additionalNotes.value.filter(n => n.id !== noteId);
      if (editingNoteId.value === noteId) {
        editingNoteId.value = null;
      }
      emit('show-toast', 'Note deleted successfully', 'success');
    } else {
      const err = await res.json();
      emit('show-toast', err.error || 'Failed to delete note', 'error');
    }
  } catch (err) {
    console.error('Error deleting note:', err);
    emit('show-toast', 'Error deleting note', 'error');
  }
}

function formatTimestamp(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

onBeforeUnmount(() => {
  if (editor.value) {
    editor.value.destroy();
  }
  if (newNoteEditor.value) {
    newNoteEditor.value.destroy();
  }
  if (activeNoteEditor.value) {
    activeNoteEditor.value.destroy();
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
      requester: editMode.value === 'work' && editRequester.value.trim() ? editRequester.value.trim() : null
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
.additional-note-item {
  border: 1px solid var(--border-color);
  padding: 0.5rem;
  background: var(--bg-surface);
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-top: 0.5rem;
}
.note-item-header {
  display: flex;
  justify-content: space-between;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 0.25rem;
}
.additional-note-content :deep(p) {
  margin-bottom: 0.8rem;
}
.additional-note-content :deep(p:last-child) {
  margin-bottom: 0;
}
.additional-note-content :deep(ul), 
.additional-note-content :deep(ol) {
  margin-left: 1.5rem;
  margin-bottom: 0.8rem;
}
.additional-note-content :deep(ul) {
  list-style-type: disc;
}
.additional-note-content :deep(ol) {
  list-style-type: decimal;
}
.additional-note-content :deep(a) {
  color: var(--accent);
  text-decoration: underline;
  cursor: pointer;
}
</style>
