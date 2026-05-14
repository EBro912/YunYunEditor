<script lang="ts">
  import { editor, setPanelCollapsed } from '../../lib/state/editorStore';

  interface Props {
    title: string;
    panelId: string;
  }
  const { title, panelId }: Props = $props();

  const collapsed = $derived(!!$editor.panelCollapsed[panelId]);
</script>

<button
  type="button"
  class="header"
  onclick={() => setPanelCollapsed(panelId, !collapsed)}
  aria-expanded={!collapsed}
  aria-controls={`panel-${panelId}`}
>
  <span class="chev" class:open={!collapsed} aria-hidden="true">▸</span>
  <h2>{title}</h2>
</button>

<style>
  .header {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    background: transparent;
    border: none;
    color: inherit;
    padding: 0;
    margin: 0 0 var(--sp-2) 0;
    cursor: pointer;
    text-align: left;
  }
  .chev {
    display: inline-block;
    color: var(--fg-mute);
    font-size: 9px;
    transition: transform 0.12s ease-out;
    width: 9px;
  }
  .chev.open {
    transform: rotate(90deg);
  }
  h2 {
    margin: 0;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--fg-mute);
    font-weight: 600;
  }
  .header:hover .chev,
  .header:hover h2 {
    color: var(--fg);
  }
</style>
