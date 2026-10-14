// src/lib/stores/projects.svelte.ts (Svelte 5 Runes)
export interface ProjectTab {
  id: string;
  name: string;
}

export const openTabs = $state<ProjectTab[]>([
  { id: "alpha", name: "Project Alpha (Test)" },
  { id: "beta", name: "Project Beta (Test)" },
]);
export function openProject(project: ProjectTab) {
  if (!openTabs.some((tab) => tab.id === project.id)) {
    openTabs.push(project);
  }
}

export function closeProject(id: string) {
  const index = openTabs.findIndex((tab) => tab.id === id);
  if (index !== -1) {
    openTabs.splice(index, 1);
  }
}
