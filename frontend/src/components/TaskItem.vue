<template>
  <div 
    class="task-item" 
    :class="{ 
      'is-completed': task.completed, 
      'is-someday': task.someday 
    }"
    :draggable="isItemDraggable"
    @dragend="isItemDraggable = false"
    @click="openDrawer"
  >
    <div class="task-content-wrapper">
      <!-- Checkbox (stems click propagation to prevent opening drawer) -->
      <input 
        type="checkbox" 
        class="cli-checkbox"
        :checked="task.completed === 1" 
        @change="toggleComplete" 
        @click.stop
      />
      
      <!-- Task Title & Tag Badges -->
      <span class="task-title" @dragstart.stop.prevent @mousedown.stop>
        <span class="task-title-text">{{ displayTitle }}</span>
        <span v-if="!inCluster && task.tags && task.tags.length > 0" class="tag-badge">
          {{ task.tags[0] }}
        </span>
        <img 
          v-if="task.freshservice_ticket_id" 
          src="/LPlogo.png" 
          alt="LP" 
          class="freshservice-logo-badge" 
          title="Freshservice Ticket" 
        />
        <span v-else-if="task.notes" class="tag-badge note-badge" title="Has Notes">
          [N]
        </span>
        <span v-if="task.completed === 1 && task.completed_at" class="completed-at-info">
          (completed: {{ formattedCompletedAt }})
        </span>
      </span>
    </div>

    <!-- Due Date / Overdue Display -->
    <div 
      v-if="dateDisplayText" 
      class="task-date-info" 
      :class="{ 'is-overdue': isOverdue }"
    >
      <!-- Clock Icon for date/time combo -->
      <svg 
        v-if="hasDueTime"
        xmlns="http://www.w3.org/2000/svg" 
        width="11" 
        height="11" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        stroke-width="2.5" 
        stroke-linecap="round" 
        stroke-linejoin="round" 
        class="due-icon"
      >
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
      </svg>
      <!-- Calendar Icon for date-only -->
      <svg 
        v-else
        xmlns="http://www.w3.org/2000/svg" 
        width="11" 
        height="11" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        stroke-width="2.5" 
        stroke-linecap="round" 
        stroke-linejoin="round" 
        class="due-icon"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="16" y1="2" x2="16" y2="6"></line>
        <line x1="8" y1="2" x2="8" y2="6"></line>
        <line x1="3" y1="10" x2="21" y2="10"></line>
      </svg>
      <span>{{ dateDisplayText }}</span>
    </div>

    <!-- Created Date -->
    <span 
      v-if="showCreatedDate && formattedCreatedDate" 
      class="task-created-date"
    >
      {{ formattedCreatedDate }}
    </span>
    
    <!-- Star Button -->
    <button 
      class="star-btn"
      :class="{ 'is-starred': task.starred === 1 }"
      @click.stop="toggleStar"
      title="Star Task"
    >
      {{ task.starred === 1 ? '★' : '☆' }}
    </button>

    <!-- Actions Dropdown -->
    <div class="actions-dropdown" ref="dropdownRef" @click.stop>
      <button class="more-actions-btn" @click="showMenu = !showMenu">
        ⋮
      </button>
      
      <div v-if="showMenu" class="dropdown-menu">
        <button class="dropdown-item" @click="openDrawer">
          Edit Details
        </button>
        <button v-if="task.mode === 'work' && isFreshserviceEnabled" class="dropdown-item" @click="syncFreshservice">
          Sync to Freshservice
        </button>
        <button class="dropdown-item" @click="toggleSomeday">
          {{ task.someday ? 'Move to Active' : 'Move to Someday' }}
        </button>
        <button class="dropdown-item" @click="switchMode">
          {{ task.mode === 'work' ? 'Move to Home' : 'Move to Work' }}
        </button>
        <button class="dropdown-item danger-action" @click="deleteTask">
          Delete Task
        </button>
      </div>
    </div>

    <!-- Drag Handle -->
    <div 
      v-if="isReorderable"
      class="drag-handle"
      @mousedown="isItemDraggable = true"
      @touchstart="isItemDraggable = true"
      @mouseup="isItemDraggable = false"
      @touchend="isItemDraggable = false"
      @click.stop
      title="Drag to reorder"
    >
      <svg width="10" height="16" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="6" cy="4" r="2" />
        <circle cx="6" cy="12" r="2" />
        <circle cx="6" cy="20" r="2" />
        <circle cx="14" cy="4" r="2" />
        <circle cx="14" cy="12" r="2" />
        <circle cx="14" cy="20" r="2" />
      </svg>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  task: {
    type: Object,
    required: true
  },
  inCluster: {
    type: Boolean,
    default: false
  },
  showCreatedDate: {
    type: Boolean,
    default: false
  },
  isReorderable: {
    type: Boolean,
    default: false
  },
  isFreshserviceEnabled: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update-task', 'delete-task', 'open-drawer', 'sync-freshservice']);

const showMenu = ref(false);
const dropdownRef = ref(null);
const isItemDraggable = ref(false);

// Strip tags from title for display
const displayTitle = computed(() => {
  const title = props.task.title || '';
  return title.replace(/#[a-zA-Z0-9-_]+/g, '').replace(/\s+/g, ' ').trim();
});

const formattedCompletedAt = computed(() => {
  if (!props.task.completed_at) return '';
  const date = new Date(props.task.completed_at);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
});

const formattedCreatedDate = computed(() => {
  if (!props.task.created_at) return '';
  return props.task.created_at.split('T')[0];
});

const todayStr = computed(() => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
});

const isOverdue = computed(() => {
  if (props.task.completed === 1 || !props.task.due_date) return false;
  const dueDatePortion = props.task.due_date.split(' ')[0];
  return dueDatePortion < todayStr.value;
});

const hasDueTime = computed(() => {
  return props.task.due_date && props.task.due_date.includes(' ');
});

const overdueDays = computed(() => {
  if (!isOverdue.value) return 0;
  const dueDatePortion = props.task.due_date.split(' ')[0];
  const due = new Date(dueDatePortion + 'T00:00:00');
  const today = new Date(todayStr.value + 'T00:00:00');
  const diffTime = today - due;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

const dateDisplayText = computed(() => {
  if (!props.task.due_date) return '';
  if (props.task.completed === 1) {
    return props.task.due_date;
  }
  if (isOverdue.value) {
    const days = overdueDays.value;
    return `Overdue by ${days} ${days === 1 ? 'Day' : 'Days'}`;
  }
  return props.task.due_date;
});

function openDrawer() {
  showMenu.value = false;
  emit('open-drawer', props.task);
}

function syncFreshservice() {
  showMenu.value = false;
  emit('sync-freshservice', props.task.id);
}

function toggleComplete(e) {
  emit('update-task', {
    ...props.task,
    completed: e.target.checked ? 1 : 0
  });
}

function toggleSomeday() {
  showMenu.value = false;
  emit('update-task', {
    ...props.task,
    someday: props.task.someday ? 0 : 1
  });
}

function switchMode() {
  showMenu.value = false;
  emit('update-task', {
    ...props.task,
    mode: props.task.mode === 'work' ? 'home' : 'work'
  });
}

function deleteTask() {
  showMenu.value = false;
  emit('delete-task', props.task.id);
}

function toggleStar() {
  emit('update-task', {
    ...props.task,
    starred: props.task.starred === 1 ? 0 : 1
  });
}

// Close dropdown on click outside
function handleClickOutside(e) {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target)) {
    showMenu.value = false;
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>
