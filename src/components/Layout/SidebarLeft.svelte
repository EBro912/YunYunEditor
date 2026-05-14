<script lang="ts">
  import SongMetadataPanel from '../Panels/SongMetadataPanel.svelte';
  import LevelListPanel from '../Panels/LevelListPanel.svelte';
  import DraftsPanel from '../Panels/DraftsPanel.svelte';
  import PanelHeader from './PanelHeader.svelte';
  import { editor } from '../../lib/state/editorStore';

  const isCollapsed = (id: string) => !!$editor.panelCollapsed[id];
</script>

<aside class="left">
  <section class="panel" class:collapsed={isCollapsed('song')}>
    <PanelHeader title="Song" panelId="song" />
    {#if !isCollapsed('song')}
      <div id="panel-song"><SongMetadataPanel /></div>
    {/if}
  </section>
  <section class="panel" class:collapsed={isCollapsed('levels')}>
    <PanelHeader title="Levels" panelId="levels" />
    {#if !isCollapsed('levels')}
      <div id="panel-levels"><LevelListPanel /></div>
    {/if}
  </section>
  <section class="panel" class:collapsed={isCollapsed('drafts')}>
    <PanelHeader title="Drafts" panelId="drafts" />
    {#if !isCollapsed('drafts')}
      <div id="panel-drafts"><DraftsPanel /></div>
    {/if}
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
  .panel.collapsed {
    padding: var(--sp-2) var(--sp-4);
  }
</style>
