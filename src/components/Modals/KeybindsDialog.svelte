<script lang="ts">
  import { KEYBINDS } from '../../lib/keybinds';

  interface Props {
    open: boolean;
    onClose: () => void;
  }
  const { open, onClose }: Props = $props();
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
      aria-labelledby="keybinds-title"
      tabindex="-1"
    >
      <header>
        <h3 id="keybinds-title">Keybinds</h3>
        <button class="close" onclick={onClose} aria-label="Close">×</button>
      </header>

      <div class="groups">
        {#each KEYBINDS as group}
          <section>
            <h4>{group.title}</h4>
            <ul>
              {#each group.binds as bind}
                <li>
                  <span class="keys">
                    {#each bind.keys as k, i}
                      {#if i > 0}<span class="plus">+</span>{/if}
                      <span class="kbd">{k}</span>
                    {/each}
                  </span>
                  <span class="action">{bind.action}</span>
                </li>
              {/each}
            </ul>
          </section>
        {/each}
      </div>
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
    width: 520px;
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
  .groups {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--sp-3) var(--sp-4);
  }
  section {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  h4 {
    margin: 0 0 2px 0;
    font-size: 11px;
    color: var(--fg-mute);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  li {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 8px;
    align-items: center;
    font-size: 12px;
  }
  .keys {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    min-width: 0;
  }
  .plus {
    color: var(--fg-mute);
    font-size: 10px;
    padding: 0 1px;
  }
  .kbd {
    font-family: var(--font-mono);
    background: var(--bg-2);
    border: var(--hairline-soft);
    border-radius: 2px;
    padding: 1px 6px;
    font-size: 11px;
    color: var(--fg);
    white-space: nowrap;
  }
  .action {
    color: var(--fg-dim);
  }
</style>
