<script lang="ts">
  import { editor, setTool, type Tool } from '../../lib/state/editorStore';

  const tools: { id: Tool; label: string; key: string }[] = [
    { id: 'select', label: 'Select', key: 'V' },
    { id: 'single', label: 'Single', key: '1' },
    { id: 'hold', label: 'Hold', key: '2' },
    { id: 'rush', label: 'Rush', key: '3' },
    { id: 'eraser', label: 'Eraser', key: '4' },
  ];
</script>

<div class="palette">
  {#each tools as t}
    <button class:active={$editor.tool === t.id} onclick={() => setTool(t.id)}>
      <span>{t.label}</span>
      <kbd class="mono">{t.key}</kbd>
    </button>
  {/each}
</div>

<style>
  .palette {
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
  button.active {
    border-color: var(--accent);
    background: rgba(106, 169, 255, 0.10);
    color: var(--accent);
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
