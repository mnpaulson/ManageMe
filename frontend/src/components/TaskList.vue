<template>
  <div>
    <!-- Empty State -->
    <div v-if="sortedListItems.length === 0" class="empty-state">
      <p>No tasks found.</p>
    </div>

    <!-- Task List -->
    <div v-else>
      <div v-for="item in sortedListItems" :key="item.id">
        <!-- Render Cluster -->
        <div v-if="item.isCluster">
          <div 
            class="cluster-header" 
            :draggable="isReorderable"
            :class="{
              'is-dragging': draggedId === item.tasks[0].id,
              'drag-over': dragOverId === item.tasks[0].id
            }"
            @dragstart="onDragStart(item.tasks[0], true, $event)"
            @dragover="onDragOver(item.tasks[0], true, $event)"
            @dragleave="onDragLeave(item.tasks[0])"
            @drop="onDrop(item, item.tasks[0], $event)"
            @dragend="onDragEnd"
            @click="toggleCluster(item.tagName)"
          >
            <div class="cluster-title-info">
              <span class="cluster-icon">></span>
              <span class="cluster-name">{{ item.tagName }}</span>
              <span class="cluster-count">{{ item.tasks.length }} tasks</span>
            </div>
            <span 
              class="cluster-chevron" 
            >
              {{ expandedClusters[item.tagName] ? '[-]' : '[+]' }}
            </span>
          </div>
          
          <div 
            v-if="expandedClusters[item.tagName]" 
            class="cluster-contents"
          >
            <TaskItem 
              v-for="task in item.tasks" 
              :key="task.id" 
              :task="task"
              :in-cluster="true"
              :show-created-date="!showCompleted && !showUpcoming"
              :is-reorderable="isReorderable"
              :is-freshservice-enabled="isFreshserviceEnabled"
              :class="{
                'is-dragging': draggedId === task.id,
                'drag-over': dragOverId === task.id
              }"
              @dragstart="onDragStart(task, false, $event)"
              @dragover="onDragOver(task, false, $event)"
              @dragleave="onDragLeave(task)"
              @drop="onDrop(item, task, $event)"
              @dragend="onDragEnd"
              @update-task="$emit('update-task', $event)"
              @delete-task="$emit('delete-task', $event)"
              @open-drawer="$emit('open-drawer', $event)"
              @sync-freshservice="$emit('sync-freshservice', $event)"
            />
          </div>
        </div>

        <!-- Render Plain Task -->
        <TaskItem 
          v-else
          :task="item.task"
          :in-cluster="false"
          :show-created-date="!showCompleted && !showUpcoming"
          :is-reorderable="isReorderable"
          :is-freshservice-enabled="isFreshserviceEnabled"
          :class="{
            'is-dragging': draggedId === item.task.id,
            'drag-over': dragOverId === item.task.id
          }"
          @dragstart="onDragStart(item.task, false, $event)"
          @dragover="onDragOver(item.task, false, $event)"
          @dragleave="onDragLeave(item.task)"
          @drop="onDrop(item, item.task, $event)"
          @dragend="onDragEnd"
          @update-task="$emit('update-task', $event)"
          @delete-task="$emit('delete-task', $event)"
          @open-drawer="$emit('open-drawer', $event)"
          @sync-freshservice="$emit('sync-freshservice', $event)"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import TaskItem from './TaskItem.vue';

const props = defineProps({
  tasks: {
    type: Array,
    required: true
  },
  currentMode: {
    type: String,
    required: true
  },
  showSomeday: {
    type: Boolean,
    required: true
  },
  showCompleted: {
    type: Boolean,
    required: true
  },
  showUpcoming: {
    type: Boolean,
    default: false
  },
  isReorderable: {
    type: Boolean,
    default: false
  },
  sortBy: {
    type: String,
    default: 'default'
  },
  completedWeekOffset: {
    type: Number,
    default: 0
  },
  isFreshserviceEnabled: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update-task', 'delete-task', 'open-drawer', 'reorder-tasks', 'sync-freshservice']);

// Dictionary to track which clusters are expanded
const expandedClusters = ref({});

function toggleCluster(tagName) {
  expandedClusters.value[tagName] = !expandedClusters.value[tagName];
}

const getLocalDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Compute cluster tags globally based on the tasks array
const clusterTags = computed(() => {
  const tagCounts = {};
  props.tasks.forEach(task => {
    // Count tags for active/uncompleted tasks in the current mode
    if (task.completed === 0 && task.mode === props.currentMode && task.tags && task.tags.length > 0) {
      const primaryTag = task.tags[0];
      tagCounts[primaryTag] = (tagCounts[primaryTag] || 0) + 1;
    }
  });
  return Object.keys(tagCounts).filter(tag => tagCounts[tag] >= 2);
});

// Main logic: Filter, Cluster, and Sort tasks
const sortedListItems = computed(() => {
  // 1. Filter tasks
  const filtered = props.tasks.filter(task => {
    const modeMatch = task.mode === props.currentMode;
    if (!modeMatch) return false;

    // Filter completed tasks to only show those completed this week
    if (props.showCompleted) {
      if (task.completed !== 1) return false;
      if (!task.completed_at) return false;
      const completedDate = new Date(task.completed_at);
      
      const refDate = new Date();
      refDate.setDate(refDate.getDate() - (props.completedWeekOffset * 7));
      const day = refDate.getDay();
      const startDay = props.currentMode === 'home' ? 1 : 2;
      const daysToSubtract = (day - startDay + 7) % 7;

      const startOfWeek = new Date(refDate);
      startOfWeek.setDate(refDate.getDate() - daysToSubtract);
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      return completedDate >= startOfWeek && completedDate <= endOfWeek;
    }

    // Uncompleted tasks
    if (task.completed !== 0) return false;

    const todayStr = getLocalDateString();

    // Upcoming view
    if (props.showUpcoming) {
      const dueDatePortion = task.due_date ? task.due_date.split(' ')[0] : null;
      return task.someday === 0 && !!dueDatePortion && dueDatePortion > todayStr;
    }

    // Someday view
    if (props.showSomeday) {
      return task.someday === 1;
    }

    // Active view
    if (task.someday !== 0) return false;

    const dueDatePortion = task.due_date ? task.due_date.split(' ')[0] : null;
    if (!dueDatePortion) return true;
    if (dueDatePortion <= todayStr) return true;
    if (task.keep_active === 1) return true;

    return false;
  });

  // If showUpcoming is true, return flat list sorted by due date ascending (no clustering)
  if (props.showUpcoming) {
    const listItems = filtered.map(task => ({
      id: `task-${task.id}`,
      isCluster: false,
      createdAt: task.created_at,
      starred: task.starred || 0,
      sortOrder: task.sort_order || 0,
      task: task
    }));
    listItems.sort((a, b) => {
      if (a.task.due_date !== b.task.due_date) {
        return a.task.due_date.localeCompare(b.task.due_date);
      }
      return new Date(a.createdAt) - new Date(b.createdAt);
    });
    return listItems;
  }

  // 2. Initialize expanded state for new cluster tags if not present
  clusterTags.value.forEach(tag => {
    if (expandedClusters.value[tag] === undefined) {
      expandedClusters.value[tag] = false; // default collapsed
    }
  });

  // 3. Separate into clusters and plain tasks
  const clusters = {};
  const plainTasks = [];

  filtered.forEach(task => {
    const primaryTag = task.tags && task.tags.length > 0 ? task.tags[0] : null;
    if (primaryTag && clusterTags.value.includes(primaryTag)) {
      if (!clusters[primaryTag]) {
        clusters[primaryTag] = [];
      }
      clusters[primaryTag].push(task);
    } else {
      plainTasks.push(task);
    }
  });

  // 4. Build combined list items
  const listItems = [];

  // Add plain tasks
  plainTasks.forEach(task => {
    listItems.push({
      id: `task-${task.id}`,
      isCluster: false,
      createdAt: task.created_at,
      starred: task.starred || 0,
      sortOrder: task.sort_order || 0,
      task: task
    });
  });

  // Add clusters
  Object.keys(clusters).forEach(tagName => {
    const clusterTasks = clusters[tagName];
    // Sort tasks inside cluster:
    // If sortBy is default: sort by starred DESC, sort_order ASC, created_at ASC
    // Otherwise: sort by starred DESC, created_at ASC
    clusterTasks.sort((a, b) => {
      const starredA = a.starred || 0;
      const starredB = b.starred || 0;
      if (starredA !== starredB) {
        return starredB - starredA; // Starred first
      }
      
      if (props.sortBy === 'default') {
        const orderA = a.sort_order || 0;
        const orderB = b.sort_order || 0;
        if (orderA !== orderB) {
          return orderA - orderB;
        }
      }
      
      return new Date(a.created_at) - new Date(b.created_at);
    });

    // Highest task determines the cluster's sorting position
    const highestTask = clusterTasks[0];

    listItems.push({
      id: `cluster-${tagName}`,
      isCluster: true,
      tagName: tagName,
      createdAt: highestTask.created_at,
      starred: highestTask.starred || 0,
      sortOrder: highestTask.sort_order || 0,
      tasks: clusterTasks
    });
  });

  // 5. Sort list items (plain tasks and clusters)
  listItems.sort((a, b) => {
    const starredA = a.starred || 0;
    const starredB = b.starred || 0;
    if (starredA !== starredB) {
      return starredB - starredA; // Starred first
    }

    if (props.sortBy === 'default') {
      const orderA = a.sortOrder || 0;
      const orderB = b.sortOrder || 0;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
    }

    return new Date(a.createdAt) - new Date(b.createdAt);
  });

  return listItems;
});

// --- DRAG AND DROP STATE & EVENTS ---
const draggedId = ref(null);
const draggedTag = ref(null); // tag of the dragged task if clustered
const dragOverId = ref(null);

function onDragStart(task, isHeader, event) {
  if (!props.isReorderable) return;
  draggedId.value = task.id;
  
  if (isHeader) {
    draggedTag.value = null; // Top-level cluster header drag
  } else {
    const primaryTag = task.tags && task.tags.length > 0 ? task.tags[0] : null;
    const isClustered = primaryTag && clusterTags.value.includes(primaryTag);
    draggedTag.value = isClustered ? primaryTag : null;
  }
  
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', task.id.toString());
  }
}

function onDragOver(task, isHeader, event) {
  if (!props.isReorderable) return;
  
  if (draggedTag.value) {
    // Clustered task is dragged: target MUST belong to the same cluster (same tag) and must NOT be the header
    if (isHeader) return;
    const targetTag = task.tags && task.tags.length > 0 ? task.tags[0] : null;
    if (targetTag !== draggedTag.value) return;
  } else {
    // Top-level drag: target must be either a plain task or a cluster header
    const primaryTag = task.tags && task.tags.length > 0 ? task.tags[0] : null;
    const isTargetClustered = primaryTag && clusterTags.value.includes(primaryTag);
    if (!isHeader && isTargetClustered) return;
  }
  
  event.preventDefault();
  dragOverId.value = task.id;
}

function onDragLeave(task) {
  if (dragOverId.value === task.id) {
    dragOverId.value = null;
  }
}

const getFlatVisualTasks = (items) => {
  const flat = [];
  items.forEach(item => {
    if (item.isCluster) {
      item.tasks.forEach(t => {
        flat.push(t);
      });
    } else {
      flat.push(item.task);
    }
  });
  return flat;
};

function onDrop(targetItem, targetTask, event) {
  if (!props.isReorderable) return;
  event.preventDefault();

  const sourceId = draggedId.value;
  if (!sourceId || sourceId === targetTask.id) return;

  const items = [...sortedListItems.value];

  if (draggedTag.value) {
    // Clustered task reordering inside the cluster
    const clusterIndex = items.findIndex(item => item.isCluster && item.tagName === draggedTag.value);
    if (clusterIndex === -1) return;

    const clusterItem = items[clusterIndex];
    const clusterTasks = [...clusterItem.tasks];

    const sourceIdx = clusterTasks.findIndex(t => t.id === sourceId);
    const targetIdx = clusterTasks.findIndex(t => t.id === targetTask.id);
    if (sourceIdx === -1 || targetIdx === -1) return;

    const [draggedTask] = clusterTasks.splice(sourceIdx, 1);
    clusterTasks.splice(targetIdx, 0, draggedTask);

    // Update cluster item's tasks
    items[clusterIndex] = {
      ...clusterItem,
      tasks: clusterTasks
    };

    // Flatten and assign orders
    const flatTasks = getFlatVisualTasks(items);
    const updates = flatTasks.map((t, idx) => ({
      id: t.id,
      sort_order: idx + 1,
      starred: t.starred || 0
    }));

    emit('reorder-tasks', updates);
  } else {
    // Top-level plain tasks / cluster headers reordering
    const sourceIdx = items.findIndex(item => {
      const rep = item.isCluster ? item.tasks[0] : item.task;
      return rep.id === sourceId;
    });
    const targetIdx = items.findIndex(item => {
      const rep = item.isCluster ? item.tasks[0] : item.task;
      return rep.id === targetTask.id;
    });

    if (sourceIdx === -1 || targetIdx === -1) return;

    const [movedItem] = items.splice(sourceIdx, 1);
    items.splice(targetIdx, 0, movedItem);

    // Determine starred boundary crossing
    const targetRepTask = targetItem.isCluster ? targetItem.tasks[0] : targetItem.task;
    const newStarred = targetRepTask.starred || 0;

    // Flatten and assign orders
    const flatTasks = getFlatVisualTasks(items);
    const updates = flatTasks.map((t, idx) => {
      // If this task was the dragged task (or part of the dragged cluster), update starred status
      const isMoved = t.id === sourceId || (movedItem.isCluster && movedItem.tasks.some(ct => ct.id === t.id));
      return {
        id: t.id,
        sort_order: idx + 1,
        starred: isMoved ? newStarred : (t.starred || 0)
      };
    });

    emit('reorder-tasks', updates);
  }

  draggedId.value = null;
  draggedTag.value = null;
  dragOverId.value = null;
}

function onDragEnd() {
  draggedId.value = null;
  draggedTag.value = null;
  dragOverId.value = null;
}
</script>
