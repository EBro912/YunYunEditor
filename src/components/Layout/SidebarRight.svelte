<script lang="ts">
  import NotePalette from '../Panels/NotePalette.svelte';
  import NoteProperties from '../Panels/NoteProperties.svelte';
  import EventEditor from '../Panels/EventEditor.svelte';
  import HistoryActions from '../Panels/HistoryActions.svelte';
  import OptionsPanel from '../Panels/OptionsPanel.svelte';
  import PanelHeader from './PanelHeader.svelte';
  import { editor } from '../../lib/state/editorStore';

  const isCollapsed = (id: string) => !!$editor.panelCollapsed[id];
</script>

<aside class="right">
  <section class="panel" class:collapsed={isCollapsed('tools')}>
    <PanelHeader title="Tools" panelId="tools" />
    {#if !isCollapsed('tools')}
      <div id="panel-tools"><NotePalette /></div>
    {/if}
  </section>
  <section class="panel" class:collapsed={isCollapsed('history')}>
    <PanelHeader title="History" panelId="history" />
    {#if !isCollapsed('history')}
      <div id="panel-history"><HistoryActions /></div>
    {/if}
  </section>
  <section class="panel" class:collapsed={isCollapsed('options')}>
    <PanelHeader title="Options" panelId="options" />
    {#if !isCollapsed('options')}
      <div id="panel-options"><OptionsPanel /></div>
    {/if}
  </section>
  <section class="panel" class:collapsed={isCollapsed('selection')}>
    <PanelHeader title="Selection" panelId="selection" />
    {#if !isCollapsed('selection')}
      <div id="panel-selection"><NoteProperties /></div>
    {/if}
  </section>
  <section class="panel" class:grow={!isCollapsed('events')} class:collapsed={isCollapsed('events')}>
    <PanelHeader title="Events" panelId="events" />
    {#if !isCollapsed('events')}
      <div id="panel-events" class="events-body"><EventEditor /></div>
    {/if}
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
  .panel.collapsed {
    padding: var(--sp-2) var(--sp-4);
  }
  .panel.grow {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .events-body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
</style>
