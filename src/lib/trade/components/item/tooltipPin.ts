// src/lib/trade/components/item/tooltipPin.ts
/**
 * Alt pins an ALREADY OPEN tooltip until Alt is released.
 * Holding Alt and then hovering never pins (repeat keydowns are ignored).
 * Call start() when a tooltip opens, stop() when it closes.
 */
export function createTooltipPin(
  onChange: (locked: boolean) => void,
  onRelease: () => void,
) {
  let locked = false;
  let watching = false;

  function release() {
    const was = locked;
    locked = false;
    stop();
    if (was) {
      onChange(false);
      onRelease();
    }
  }
  function down(e: KeyboardEvent) {
    if (e.key !== "Alt") return;
    e.preventDefault(); // keeps the webview menu bar from taking focus
    if (e.repeat || locked) return; // held before hovering -> no pin
    locked = true;
    onChange(true);
  }
  function up(e: KeyboardEvent) {
    if (e.key !== "Alt") return;
    e.preventDefault();
    if (locked) release(); // releasing a plain held Alt does nothing
  }
  function start() {
    if (watching) return;
    watching = true;
    window.addEventListener("keydown", down, true);
    window.addEventListener("keyup", up, true);
    window.addEventListener("blur", release); // Alt+Tab never sends keyup
  }
  function stop() {
    if (!watching) return;
    watching = false;
    window.removeEventListener("keydown", down, true);
    window.removeEventListener("keyup", up, true);
    window.removeEventListener("blur", release);
  }
  return { start, stop, isLocked: () => locked };
}
