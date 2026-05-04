<script lang="ts">
  import { undo, redo } from '../../lib/state/history';
</script>

<div class="actions">
  <button onclick={() => undo()} title="Undo">
    <span>Undo</span>
    <kbd class="mono">Ctrl+Z</kbd>
  </button>
  <button onclick={() => redo()} title="Redo">
    <span>Redo</span>
    <kbd class="mono">Ctrl+Shift+Z</kbd>
  </button>
</div>

<style>
  .actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }
  button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--bg-2);
    border: var(--hairline);
    color: var(--fg);
    padding: 9px 12px;
    border-radius: 2px;
    cursor: pointer;
    font-size: 13px;
  }
  button:hover {
    background: var(--bg-3);
  }
  kbd {
    font-size: 10px;
    color: var(--fg-mute);
    background: var(--bg-1);
    padding: 1px 4px;
    border: var(--hairline-soft);
    border-radius: 2px;
  }
</style>
