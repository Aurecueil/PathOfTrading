// src/lib/types/types.ts
export type SearchMode = "regular" | "live" | "mixed";
export type TileDisplayStyle = "auto" | "full" | "compact" | "minimal";
export type ResolvedDisplayStyle = "full" | "compact" | "minimal";

export interface CameraState {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface SearchTile {
  id: string | number;
  x: number;
  y: number;
  w: number;
  h: number;
  realm: "poe" | "poe2" | string;
  league?: string;
  title?: string;
  displayName?: string;
  displayStyle?: TileDisplayStyle;
  disabled?: boolean;
  payload?: any;
  full_payload?: any;
  searchId?: string;
  results: string[];
  loading?: boolean;
  mode?: SearchMode;
  displayOptions?: TileDisplayOptions;
  currency: string;
  searchOnLoad: boolean;
}

export interface SavedSearchTile {
  x: number;
  y: number;
  w: number;
  h: number;
  realm: "poe" | "poe2" | string;
  league: string;
  title: string;
  disabled: boolean;
  full_payload: any;
  mode: SearchMode;
  displayOptions?: TileDisplayOptions;
  currency: string;
  searchOnLoad: boolean;
}

export type ToolType =
  | "move"
  | "title"
  | "richtext"
  | "arrow"
  | "box"
  | "circle";
export type ShapeKind = "arrow" | "box" | "circle";

export interface CanvasAnnotation {
  id: number;
  kind: "title" | "richtext" | ShapeKind;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  thickness: number;
  text?: string;
  flipX?: boolean;
  flipY?: boolean;
  autoEdit?: boolean;
}

export type ProjectItem = SavedSearchTile | CanvasAnnotation;

export interface SavedProject {
  id: string;
  name: string;
  realm: "poe" | "poe2" | string;
  league: string;
  camera: CameraState;
  updated_at?: number;
  items: ProjectItem[];
}

export interface ProjectIndexEntry {
  id: string;
  name: string;
  realm: string;
  league: string;
  updated_at: number;
  tile_count: number;
  annotation_count: number;
}

export interface ShareCodePayload {
  camera?: CameraState;
  realm?: string;
  league?: string;
  items: ProjectItem[];
}

export interface FormSubmitData {
  title: string;
  displayName?: string;
  realm: "poe" | "poe2";
  league: string;
  payload: any;
  full_payload: any;
}

export interface SortOptionItem {
  id: string;
  category: "group" | "filter" | "stat";
  label: string;
  tag?: string;
}
export interface TileDisplayOptions {
  displayImplicitMods: boolean;
  displayExplicitMods: boolean;
  displayEnchantMods: boolean;
  displayRuneMods: boolean;
  displayScourgeMods: boolean; // poe1
  displayBondedMods: boolean; // poe2
  displayCrucibleMods: boolean; // poe1
  displayVeiledMods: boolean;
  displayPseudoMods: boolean;
}
