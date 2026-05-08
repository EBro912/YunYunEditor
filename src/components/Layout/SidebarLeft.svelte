<script lang="ts">
  import SongMetadataPanel from '../Panels/SongMetadataPanel.svelte';
  import LevelListPanel from '../Panels/LevelListPanel.svelte';
  import DraftsPanel from '../Panels/DraftsPanel.svelte';
</script>

<aside class="left">
  <section class="panel">
    <h2>Song</h2>
    <SongMetadataPanel />
  </section>
  <section class="panel">
    <h2>Levels</h2>
    <LevelListPanel />
  </section>
  <section class="panel">
    <h2>Drafts</h2>
    <DraftsPanel />
  </section>
</aside>

<style>
  .left {
    display: flex;
    flex-direction: column;
    width: 360px;
    border-right: var(--hairline);
    background: var(--bg-1);
    overflow-y: auto;
  }
  .panel {
    padding: var(--sp-3) var(--sp-4);
    border-bottom: var(--hairline);
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
