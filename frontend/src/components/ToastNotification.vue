<template>
  <div class="toast-container">
    <div 
      v-for="toast in toasts" 
      :key="toast.id" 
      class="toast-item"
      :class="'toast-' + toast.type"
      @click="$emit('close', toast.id)"
    >
      <span class="toast-symbol">>_</span>
      <span class="toast-message">{{ toast.message }}</span>
      <button class="toast-close" @click.stop="$emit('close', toast.id)">×</button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  toasts: {
    type: Array,
    required: true
  }
});

defineEmits(['close']);
</script>

<style scoped>
.toast-container {
  position: fixed;
  bottom: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 90%;
  max-width: 400px;
  pointer-events: none;
}

.toast-item {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.6rem 0.8rem;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--text-primary);
  cursor: pointer;
  user-select: none;
}

.toast-item:hover {
  border-color: var(--border-color-focus);
  background: var(--bg-surface-hover);
}

.toast-symbol {
  color: var(--accent);
  font-weight: bold;
}

.toast-message {
  flex: 1;
  white-space: pre-wrap;
  line-height: 1.3;
}

.toast-close {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 1rem;
  cursor: pointer;
  padding: 0 0.2rem;
  line-height: 1;
}

.toast-close:hover {
  color: var(--text-primary);
}

/* Monospace accented status variants */
.toast-success {
  border-color: var(--color-success);
}
.toast-success .toast-symbol {
  color: var(--color-success);
}

.toast-error {
  border-color: var(--color-danger);
}
.toast-error .toast-symbol {
  color: var(--color-danger);
}
.toast-error .toast-message {
  color: var(--color-danger);
}

.toast-info {
  border-color: var(--accent);
}
.toast-info .toast-symbol {
  color: var(--accent);
}
</style>
