<script lang="ts">
  import NotePalette from '../Panels/NotePalette.svelte';
  import NoteProperties from '../Panels/NoteProperties.svelte';
  import EventEditor from '../Panels/EventEditor.svelte';
  import HistoryActions from '../Panels/HistoryActions.svelte';
</script>

<aside class="right">
  <section class="panel">
    <h2>Tools</h2>
    <NotePalette />
  </section>
  <section class="panel">
    <h2>History</h2>
    <HistoryActions />
  </section>
  <section class="panel">
    <h2>Selection</h2>
    <NoteProperties />
  </section>
  <section class="panel grow">
    <h2>Events</h2>
    <EventEditor />
  </section>
</aside>

<style>
  .right {
    display: flex;
    flex-direction: column;
    width: 360px;
    border-left: var(--hairline);
    background: var(--bg-1);
    overflow-y: auto;
  }
  .panel {
    padding: var(--sp-3) var(--sp-4);
    border-bottom: var(--hairline);
  }
  .panel.grow {
    flex: 1;
    min-height: 0;
  }
  h2 {
    margin: 0 0 var(--sp-2) 0;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--fg-mute);
    font-weight: 600;
  }
</style>
