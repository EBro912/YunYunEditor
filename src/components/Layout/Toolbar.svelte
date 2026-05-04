<script lang="ts">
  interface Props {
    onNew?: () => void;
    onImport?: () => void;
    onImportAudio?: () => void;
    onExport?: () => void;
  }
  const { onNew, onImport, onImportAudio, onExport }: Props = $props();
</script>

{#snippet githubIcon()}
  <svg class="gh-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <path fill="currentColor" fill-rule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
  </svg>
{/snippet}

<header class="toolbar">
  <div class="brand">
    <span class="title">YunYunEditor</span>
  </div>
  <div class="group">
    <button onclick={() => onNew?.()}>New</button>
    <button onclick={() => onImport?.()}>Import .zip</button>
    <button onclick={() => onImportAudio?.()} title="Replace audio with a .ogg file">Import audio</button>
    <button onclick={() => onExport?.()}>Export</button>
  </div>
  <div class="group right">
    <a
      class="repo-link"
      href="https://github.com/EBro912/YunYunLoader"
      target="_blank"
      rel="noopener noreferrer"
      title="YunYunLoader on GitHub"
    >
      {@render githubIcon()}
      <span>YunYunLoader</span>
    </a>
    <a
      class="repo-link"
      href="https://github.com/EBro912/YunYunEditor"
      target="_blank"
      rel="noopener noreferrer"
      title="YunYunEditor on GitHub"
    >
      {@render githubIcon()}
      <span>YunYunEditor</span>
    </a>
  </div>
</header>

<style>
  .toolbar {
    display: flex;
    align-items: center;
    gap: var(--sp-4);
    height: 52px;
    padding: 0 var(--sp-4);
    border-bottom: var(--hairline);
    background: var(--bg-0);
  }
  .brand {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    font-weight: 600;
    font-size: 14px;
  }
  .logo {
    display: inline-grid;
    place-items: center;
    width: 26px;
    height: 26px;
    background: var(--lane-edge);
    color: var(--bg-0);
    border-radius: 3px;
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 700;
  }
  .group {
    display: flex;
    gap: var(--sp-2);
  }
  .group.right {
    margin-left: auto;
  }
  button {
    background: var(--bg-2);
    color: var(--fg);
    border: var(--hairline);
    padding: 7px 14px;
    border-radius: 2px;
    cursor: pointer;
    font-size: 13px;
  }
  button:hover {
    background: var(--bg-3);
  }
  .repo-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: var(--bg-2);
    color: var(--fg);
    border: var(--hairline);
    padding: 7px 12px;
    border-radius: 2px;
    font-size: 13px;
    text-decoration: none;
    cursor: pointer;
    font-family: inherit;
  }
  .repo-link:hover {
    background: var(--bg-3);
  }
  .gh-icon {
    flex-shrink: 0;
  }
</style>
