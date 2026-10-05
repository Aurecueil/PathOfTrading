<script lang="ts">
  import { onMount } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { listen } from "@tauri-apps/api/event";

  let isAuthenticated = false;
  let currentToken = "";
  let currentID = "";
  let statusMessage = "";
  let response_search = "";
  let isLoading = false;

  onMount(async () => {
    // 2. Listen for successful login from Rust window
    const unlisten = await listen<string>("poe_auth_success", (event) => {
      statusMessage = "Login successful! POETOKEN generated.";
      isLoading = false;
    });

    return () => unlisten();
  });

  async function handleLogin() {
    isLoading = true;
    statusMessage = "Awaiting login in popup window...";
    try {
      await invoke("open_poe_login");
    } catch (err: any) {
      statusMessage = `Error opening login: ${err}`;
      isLoading = false;
    }
  }

  async function refresh_view() {
    currentID = await invoke<string>("load_secret", { key: "poesessid" });
    currentToken = await invoke<string>("load_secret", { key: "poetoken" });
  }

  async function handleRefreshToken() {
    isLoading = true;
    statusMessage = "Minting fresh POETOKEN via background POESESSID...";
    try {
      currentToken = await invoke<string>("refresh_poetoken_background");
      statusMessage = "POETOKEN refreshed successfully!";
    } catch (err: any) {
      statusMessage = `Failed to refresh: ${err}`;
      isAuthenticated = false; // Session likely expired on server
    } finally {
      isLoading = false;
    }
  }

  async function handleSearch() {
    statusMessage = "SearchAttempt";
    try {
      const raw = await invoke<string>("getitems");
      const parsed: any = JSON.parse(raw);

      response_search = ""; // reset before building the string

      for (const item of parsed.result ?? []) {
        response_search += `${item?.item?.name} ${item?.listing?.price?.amount} ${item?.listing?.price?.currency}\n`;
      }
    } catch (err: any) {
      response_search = `Failed to refresh: ${err}`;
    }
  }
</script>

<main
  style="padding: 2rem; max-width: 650px; margin: auto; font-family: sans-serif;"
>
  <h2>Path of Exile API Bridge</h2>

  <div style="margin-bottom: 1.5rem;">
    {#if !isAuthenticated}
      <button
        on:click={handleLogin}
        disabled={isLoading}
        style="padding: 0.6rem 1.2rem;"
      >
        {isLoading ? "Waiting for Login..." : "Log in via Path of Exile"}
      </button>
    {:else}
      <button
        on:click={handleRefreshToken}
        disabled={isLoading}
        style="padding: 0.6rem 1.2rem;"
      >
        Refresh POETOKEN (Background)
      </button>
      <span style="color: green; margin-left: 1rem;">● Authenticated</span>
    {/if}
  </div>

  <button
    on:click={refresh_view}
    disabled={isLoading}
    style="padding: 0.6rem 1.2rem;"
  >
    View
  </button>
  <button
    on:click={handleRefreshToken}
    disabled={isLoading}
    style="padding: 0.6rem 1.2rem;"
  >
    Referesh
  </button>

  {#if statusMessage}
    <p><strong>Status:</strong> {statusMessage}</p>
  {/if}

  {#if currentToken}
    <div
      style="background: #eee; padding: 1rem; border-radius: 4px; word-break: break-all;"
    >
      <strong>Active POETOKEN (valid for 24h):</strong>
      <pre style="margin-top: 0.5rem;">{currentToken}</pre>
    </div>
  {/if}
  {#if currentID}
    <div
      style="background: #eee; padding: 1rem; border-radius: 4px; word-break: break-all;"
    >
      <strong>Active PODDESID (valid for 24h):</strong>
      <pre style="margin-top: 0.5rem;">{currentID}</pre>
    </div>
  {/if}

  <button
    on:click={handleSearch}
    disabled={isLoading}
    style="padding: 0.6rem 1.2rem;"
  >
    search
  </button>
  <div
    style="background: #eee; padding: 1rem; border-radius: 4px; word-break: break-all;"
  >
    <strong>response (valid for 24h):</strong>
    <pre style="margin-top: 0.5rem;">{response_search}</pre>
  </div>
</main>
