<script lang="ts">
  let { children } = $props();

  let fileMenuOpen = $state(false);

  function toggleFileMenu(event: MouseEvent) {
    event.stopPropagation();
    fileMenuOpen = !fileMenuOpen;
  }

  function closeMenu() {
    fileMenuOpen = false;
  }

  function handleAction(actionName: string) {
    closeMenu();
    console.log(`Action triggered: ${actionName}`);
  }
</script>

<svelte:window onclick={closeMenu} />

<div class="shell">
  <header class="header-bar">
    <div class="menu-group">
      <div class="menu-item-container">
        <button
          type="button"
          class="menu-btn"
          class:active={fileMenuOpen}
          onclick={toggleFileMenu}
        >
          File
        </button>

        {#if fileMenuOpen}
          <div class="dropdown-menu">
            <button
              type="button"
              class="dropdown-item"
              onclick={() => handleAction("new")}
            >
              <span>New File</span>
              <kbd>Ctrl+N</kbd>
            </button>
            <button
              type="button"
              class="dropdown-item"
              onclick={() => handleAction("open")}
            >
              <span>Open...</span>
              <kbd>Ctrl+O</kbd>
            </button>
            <div class="divider"></div>
            <button
              type="button"
              class="dropdown-item"
              onclick={() => handleAction("save")}
            >
              <span>Save</span>
              <kbd>Ctrl+S</kbd>
            </button>
          </div>
        {/if}
      </div>
    </div>
  </header>

  <!-- Route content changes below the action bar -->
  <main class="content">
    {@render children()}
  </main>
</div>

<style>
  :global(body, html) {
    margin: 0;
    padding: 0;
    height: 100%;
    overflow: hidden;
    font-family:
      system-ui,
      -apple-system,
      sans-serif;
    user-select: none;
  }

  .shell {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background-color: #252526;
    color: #cccccc;
  }

  /* Action Bar */
  .header-bar {
    height: 35px;
    background: #252526;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 8px;
    border-bottom: 1px solid #333333;
    position: relative;
    z-index: 1000;
  }

  .menu-group {
    display: flex;
    gap: 4px;
  }

  .menu-item-container {
    position: relative;
  }

  .menu-btn {
    background: transparent;
    border: none;
    color: #cccccc;
    padding: 4px 8px;
    font-size: 13px;
    border-radius: 4px;
    cursor: pointer;
  }

  .menu-btn:hover,
  .menu-btn.active {
    background: #3c3c3c;
    color: #ffffff;
  }

  /* Dropdown styling */
  .dropdown-menu {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    min-width: 180px;
    background: #252526;
    border: 1px solid #454545;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    padding: 4px 0;
    display: flex;
    flex-direction: column;
  }

  .dropdown-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: transparent;
    border: none;
    color: #cccccc;
    padding: 6px 12px;
    font-size: 13px;
    cursor: pointer;
    text-align: left;
  }

  .dropdown-item:hover {
    background: #094771;
    color: #ffffff;
  }

  .dropdown-item kbd {
    font-size: 11px;
    color: #888888;
    background: #1e1e1e;
    padding: 2px 4px;
    border-radius: 3px;
  }

  .divider {
    height: 1px;
    background: #3e3e42;
    margin: 4px 0;
  }

  /* Main routed content */
  .content {
    flex: 1;
    overflow-y: auto;
    background-color: black;
    user-select: text; /* re-enable text selection for page content */
  }
</style>
