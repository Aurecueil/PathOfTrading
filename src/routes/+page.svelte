<script lang="ts">
  import { openProject } from "../lib/projects.svelte";
  function handleOpenTest() {
    openProject({
      id: "test-123",
      name: "My Demo Project",
    });
  }
</script>

<main
  style="padding: 2rem; max-width: 650px; margin: auto; font-family: sans-serif;"
>
  <h2>Path of Exile API Bridge</h2>
  <button onclick={handleOpenTest}> click me</button>
</main>
