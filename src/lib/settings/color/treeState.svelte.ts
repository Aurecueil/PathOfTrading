/** UI-only state shared by both rule trees. */
export const treeUi = $state({
  view: "custom" as "custom" | "default",
  focusId: null as string | null, // node to start renaming after creation
});
