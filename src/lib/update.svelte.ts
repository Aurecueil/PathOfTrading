// src/lib/updater/updaterState.svelte.ts
const WHATS_NEW_STORAGE_KEY = "pot_whats_new_data";

export interface WhatsNewData {
  version: string;
  body: string;
}

class UpdaterStore {
  updateAvailable = $state(false);
  updateVersion = $state("");
  updateBody = $state("");
  isChecking = $state(false);
  isUpdating = $state(false);
  updateProgress = $state(0);
  updateError = $state("");
  updateDownloaded = $state(false);

  whatsNew = $state<WhatsNewData | null>(null);
  whatsNewModalOpen = $state(false);

  private updaterModule: any = null;
  private cachedUpdateObj: any = null;

  constructor() {
    if (typeof window !== "undefined") {
      this.loadWhatsNewFromStorage();
    }
  }

  loadWhatsNewFromStorage() {
    try {
      const raw = localStorage.getItem(WHATS_NEW_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.version) {
          this.whatsNew = {
            version: String(parsed.version),
            body: String(parsed.body || ""),
          };
        }
      }
    } catch (e) {
      console.error("Failed to read What's New from localStorage:", e);
    }
  }

  saveWhatsNewToStorage(version: string, body: string) {
    try {
      const payload: WhatsNewData = { version, body };
      localStorage.setItem(WHATS_NEW_STORAGE_KEY, JSON.stringify(payload));
      this.whatsNew = payload;
    } catch (e) {
      console.error("Failed to save What's New to localStorage:", e);
    }
  }

  async checkForUpdates(manual = false): Promise<boolean> {
    if (this.isChecking || this.isUpdating) return false;
    this.isChecking = true;
    if (manual) this.updateError = "";

    try {
      if (!this.updaterModule) {
        this.updaterModule = await import("@tauri-apps/plugin-updater");
      }
      const update = await this.updaterModule.check();

      if (update) {
        this.cachedUpdateObj = update;
        this.updateAvailable = true;
        this.updateVersion = update.version;
        this.updateBody = update.body || "";
        return true;
      } else {
        this.updateAvailable = false;
        return false;
      }
    } catch (e: any) {
      console.error("Failed to check for updates:", e);
      if (manual) {
        this.updateError = e?.message || "Failed to check for updates.";
      }
      return false;
    } finally {
      this.isChecking = false;
    }
  }

  async downloadAndInstallUpdate() {
    if (this.isUpdating) return;
    try {
      this.isUpdating = true;
      this.updateError = "";
      this.updateProgress = 0;

      if (!this.updaterModule) {
        this.updaterModule = await import("@tauri-apps/plugin-updater");
      }

      const update = this.cachedUpdateObj || (await this.updaterModule.check());
      if (!update) {
        this.isUpdating = false;
        this.updateAvailable = false;
        return;
      }

      // Save the incoming release's version & body as "What's New" before installing
      this.saveWhatsNewToStorage(update.version, update.body || "");

      let downloaded = 0;
      let contentLength = 0;

      await update.downloadAndInstall((event: any) => {
        switch (event.event) {
          case "Started":
            contentLength = event.data.contentLength || 0;
            break;
          case "Progress":
            downloaded += event.data.chunkLength;
            if (contentLength > 0) {
              this.updateProgress = Math.min(
                100,
                Math.round((downloaded / contentLength) * 100),
              );
            }
            break;
          case "Finished":
            this.updateProgress = 100;
            this.updateDownloaded = true;
            break;
        }
      });

      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (e: any) {
      console.error("Failed to install update:", e);
      this.updateError = e?.message || "Failed to install update.";
      this.isUpdating = false;
    }
  }
}

export const updaterState = new UpdaterStore();

export function renderMarkdown(md: string): string {
  if (!md) return "";
  return md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/^### (.*$)/gim, "<h3>$1</h3>")
    .replace(/^## (.*$)/gim, "<h2>$1</h2>")
    .replace(/^# (.*$)/gim, "<h1>$1</h1>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`(.*?)`/g, "<code>$1</code>")
    .replace(/^\s*[-*+] (.*$)/gim, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
    .replace(/\n\n+/g, "<br><br>")
    .replace(/(?<!>)\n(?!<)/g, "<br>");
}