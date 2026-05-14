<script lang="ts">
  interface Props {
    open: boolean;
    onClose: () => void;
  }
  const { open, onClose }: Props = $props();

  const version = __APP_VERSION__;

  interface ChangelogEntry {
    version: string;
    date?: string;
    changes: string[];
  }

  const changelog: ChangelogEntry[] = [
    {
      version: '0.3.0',
      changes: [
        'Added an Options panel with toggles for preventing duplicate notes, locking notes, mirroring placement, and note snapping.',
        'Moved the ScoreOffset section to the new Options panel with a new \'ms\' button to display the ScoreOffset in milliseconds.',
        'Added a playback speed slider.',
        'Added S/D/K/L keybinds to place a single note in each respective lane at the playhead.',
        'Added a keybinds dialog accessible from the toolbar or the ? key.',
        'A level will now be auto-created when an .ogg is dropped into a fresh project.',
        'Added a confirmation prompt for deleting levels (can still be undone with Ctrl+Z).',
        'Added collapsible panel headers on both sidebars.',
        'Zoom now displays as a percentage with direct numeric input.',
        'Inverted the scrollbar to match the playfield direction.',
        'Fixed 1/16th Hold and Rush note tails not ending exactly on the beat grid.',
        'Fixed notes drifting off the snap grid when dragged.',
      ],
    },
    {
      version: '0.2.2',
      changes: [
        'Added dropdowns for selecting a level. If a level slot is already taken, a swap prompt will appear.',
        'Events now spawn relative to the current scroll position rather than the next valid TPQN from zero ticks.',
        'Fixed levels being able to go above five.',
        'Fixed levels being able to have the same level number.',
        'Improved visibilty of the level add section being disabled when level slots are full.',
      ],
    },
    {
      version: '0.2.1',
      changes: [
        'Added copy / paste for selected notes (Ctrl+C / Ctrl+V). Pasted notes anchor to the playhead and preserve relative timing.',
        'Loading a draft now prompts for confirmation when you have unsaved work.',
        'Fixed long Hold and Rush notes disappearing when their tail scrolled off the top of the screen.',
      ],
    },
    {
      version: '0.2.0',
      changes: [
        'Added a volume slider to the transport bar (persists across sessions).',
        'Added a vertical chart scrollbar with jump-to-start / jump-to-end controls.',
        'Added this About dialog with version info and changelog.',
        'Various bugfixes and improvements.',
      ],
    },
    {
      version: '0.1.0',
      changes: [
        'Initial public release: import / edit / export YunYunLoader mods entirely in the browser.',
        'Drafts panel with up to 20 saved local sessions.',
      ],
    },
  ];
</script>

{#if open}
  <div
    class="backdrop"
    onclick={onClose}
    onkeydown={(e) => e.key === 'Escape' && onClose()}
    role="button"
    tabindex="-1"
  >
    <div
      class="dialog"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      role="dialog"
      aria-labelledby="about-title"
      tabindex="-1"
    >
      <header>
        <h3 id="about-title">About</h3>
        <button class="close" onclick={onClose} aria-label="Close">×</button>
      </header>

      <section class="intro">
        <div class="title-row">
          <span class="app-name">YunYunEditor</span>
          <span class="version mono">v{version}</span>
        </div>
        <p>
          A web-based visual chart editor for
          <a href="https://github.com/EBro912/YunYunLoader" target="_blank" rel="noopener noreferrer">YunYunLoader</a>
          mods. Runs entirely in your browser; no account, no ads.
          Your work is autosaved locally and can be exported as a YunYunLoader-ready mod in a single click.
        </p>
      </section>

      <section>
        <h4>Changelog</h4>
        <div class="changelog">
          {#each changelog as entry}
            <div class="entry">
              <div class="entry-head">
                <span class="entry-ver mono">v{entry.version}</span>
                {#if entry.date}
                  <span class="entry-date dim">{entry.date}</span>
                {/if}
              </div>
              <ul>
                {#each entry.changes as line}
                  <li>{line}</li>
                {/each}
              </ul>
            </div>
          {/each}
        </div>
      </section>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: grid;
    place-items: center;
    z-index: 50;
  }
  .dialog {
    background: var(--bg-1);
    border: var(--hairline);
    padding: var(--sp-4);
    width: 480px;
    max-width: 90vw;
    max-height: 80vh;
    overflow-y: auto;
    border-radius: 4px;
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  h3 {
    margin: 0;
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--fg-dim);
  }
  .close {
    background: transparent;
    border: none;
    color: var(--fg-mute);
    font-size: 18px;
    cursor: pointer;
  }
  section {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
    border-top: var(--hairline-soft);
    padding-top: var(--sp-2);
  }
  section:first-of-type {
    border-top: none;
    padding-top: 0;
  }
  h4 {
    margin: 0;
    font-size: 11px;
    color: var(--fg-mute);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  p {
    margin: 0;
    color: var(--fg);
    font-size: 13px;
    line-height: 1.5;
  }
  p.dim {
    color: var(--fg-dim);
    font-size: 12px;
  }
  a {
    color: var(--accent);
    text-decoration: none;
  }
  a:hover {
    text-decoration: underline;
  }
  .title-row {
    display: flex;
    align-items: baseline;
    gap: var(--sp-2);
  }
  .app-name {
    font-size: 16px;
    font-weight: 600;
  }
  .version {
    color: var(--fg-mute);
    font-size: 12px;
  }
  .changelog {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
  }
  .entry {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .entry-head {
    display: flex;
    align-items: baseline;
    gap: var(--sp-2);
  }
  .entry-ver {
    color: var(--accent);
    font-size: 12px;
    font-weight: 600;
  }
  .entry-date {
    font-size: 11px;
  }
  .entry ul {
    margin: 0;
    padding-left: var(--sp-4);
    color: var(--fg);
    font-size: 13px;
    line-height: 1.5;
  }
  .entry li {
    margin: 2px 0;
  }
</style>
