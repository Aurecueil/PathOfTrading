<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { listen } from '@tauri-apps/api/event';

  let isAuthenticated = false;
  let currentToken = '';
  let statusMessage = '';
  let isLoading = false;

  onMount(async () => {
    // 1. Check if user has an active stored session
    isAuthenticated = await invoke<boolean>('check_auth_status');

    if (isAuthenticated) {
      statusMessage = 'Active session found in keychain. Ready.';
    }

    // 2. Listen for successful login from Rust window
    const unlisten = await listen<string>('poe_auth_success', (event) => {
      isAuthenticated = true;
      currentToken = event.payload;
      statusMessage = 'Login successful! POETOKEN generated.';
      isLoading = false;
    });

    return () => unlisten();
  });

  async function handleLogin() {
    isLoading = true;
    statusMessage = 'Awaiting login in popup window...';
    try {
      await invoke('open_poe_login');
    } catch (err: any) {
      statusMessage = `Error opening login: ${err}`;
      isLoading = false;
    }
  }

  async function handleRefreshToken() {
    isLoading = true;
    statusMessage = 'Minting fresh POETOKEN via background POESESSID...';
    try {
      currentToken = await invoke<string>('refresh_poetoken_background');
      statusMessage = 'POETOKEN refreshed successfully!';
    } catch (err: any) {
      statusMessage = `Failed to refresh: ${err}`;
      isAuthenticated = false; // Session likely expired on server
    } finally {
      isLoading = false;
    }
  }
</script>

<main style="padding: 2rem; max-width: 650px; margin: auto; font-family: sans-serif;">
  <h2>Path of Exile API Bridge</h2>

  <div style="margin-bottom: 1.5rem;">
    {#if !isAuthenticated}
      <button on:click={handleLogin} disabled={isLoading} style="padding: 0.6rem 1.2rem;">
        {isLoading ? 'Waiting for Login...' : 'Log in via Path of Exile'}
      </button>
    {:else}
      <button on:click={handleRefreshToken} disabled={isLoading} style="padding: 0.6rem 1.2rem;">
        Refresh POETOKEN (Background)
      </button>
      <span style="color: green; margin-left: 1rem;">● Authenticated</span>
    {/if}
  </div>

  {#if statusMessage}
    <p><strong>Status:</strong> {statusMessage}</p>
  {/if}

  {#if currentToken}
    <div style="background: #eee; padding: 1rem; border-radius: 4px; word-break: break-all;">
      <strong>Active POETOKEN (valid for 24h):</strong>
      <pre style="margin-top: 0.5rem;">{currentToken}</pre>
    </div>
  {/if}
</main>