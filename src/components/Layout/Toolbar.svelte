<script lang="ts">
  interface Props {
    onNew?: () => void;
    onImport?: () => void;
    onImportAudio?: () => void;
    onExport?: () => void;
    onAbout?: () => void;
  }
  const { onNew, onImport, onImportAudio, onExport, onAbout }: Props = $props();
</script>

{#snippet githubIcon()}
  <svg class="gh-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <path fill="currentColor" fill-rule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
  </svg>
{/snippet}

{#snippet discordIcon()}
  <svg class="discord-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <path fill="currentColor" d="M13.545 2.907a13.227 13.227 0 0 0-3.257-1.011.05.05 0 0 0-.052.025c-.141.25-.297.577-.406.833a12.19 12.19 0 0 0-3.658 0 8.258 8.258 0 0 0-.412-.833.051.051 0 0 0-.052-.025c-1.125.194-2.22.534-3.257 1.011a.041.041 0 0 0-.021.018C.356 6.024-.213 9.047.066 12.032c.001.014.01.028.021.037a13.276 13.276 0 0 0 3.995 2.02.05.05 0 0 0 .056-.019c.308-.42.582-.863.818-1.329a.05.05 0 0 0-.01-.059.051.051 0 0 0-.018-.011 8.875 8.875 0 0 1-1.248-.595.05.05 0 0 1-.02-.066.051.051 0 0 1 .015-.019c.084-.063.168-.129.248-.195a.05.05 0 0 1 .051-.007c2.619 1.196 5.454 1.196 8.041 0a.052.052 0 0 1 .053.007c.08.066.164.132.248.195a.051.051 0 0 1-.004.085 8.254 8.254 0 0 1-1.249.594.05.05 0 0 0-.03.03.052.052 0 0 0 .003.041c.24.465.515.909.817 1.329a.05.05 0 0 0 .056.019 13.235 13.235 0 0 0 4.001-2.02.049.049 0 0 0 .021-.037c.334-3.451-.559-6.449-2.366-9.106a.034.034 0 0 0-.02-.019Zm-8.198 7.307c-.789 0-1.438-.724-1.438-1.612 0-.889.637-1.613 1.438-1.613.807 0 1.45.73 1.438 1.613 0 .888-.637 1.612-1.438 1.612Zm5.316 0c-.788 0-1.438-.724-1.438-1.612 0-.889.637-1.613 1.438-1.613.807 0 1.451.73 1.438 1.613 0 .888-.631 1.612-1.438 1.612Z"/>
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
    <button class="about-btn" onclick={() => onAbout?.()} title="About YunYunEditor">
      <svg class="info-icon" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <path
          fill="currentColor"
          d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0zm-.75 4.5a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0zM7 7h1.5v5H7V7z"
        />
      </svg>
      <span>About</span>
    </button>
    <a
      class="repo-link discord-link"
      href="https://discord.gg/qHD7xeWHUU"
      target="_blank"
      rel="noopener noreferrer"
      title="Join the Discord server"
    >
      {@render discordIcon()}
      <span>Discord</span>
    </a>
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
  .discord-icon {
    flex-shrink: 0;
    color: var(--fg-dim);
  }
  .discord-link:hover .discord-icon {
    color: #5865f2;
  }
  .about-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: var(--bg-2);
    color: var(--fg);
    border: var(--hairline);
    padding: 7px 12px;
    border-radius: 2px;
    font-size: 13px;
    cursor: pointer;
    font-family: inherit;
  }
  .about-btn:hover {
    background: var(--bg-3);
  }
  .info-icon {
    flex-shrink: 0;
    color: var(--fg-dim);
  }
  .about-btn:hover .info-icon {
    color: var(--accent);
  }
</style>
