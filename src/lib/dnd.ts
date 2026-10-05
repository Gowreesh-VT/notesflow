/** Shared drag-and-drop payload for moving tasks between views, columns, days and time slots. */

export const ITEM_DRAG_TYPE = "application/x-notesflow-item";

export function setDragItem(event: React.DragEvent, itemId: string): void {
  event.dataTransfer.setData(ITEM_DRAG_TYPE, itemId);
  // Plain text too, so dropping into an editor or another app does something sensible.
  event.dataTransfer.setData("text/plain", itemId);
  event.dataTransfer.effectAllowed = "move";
}

/** True while something we can drop is being dragged (the id itself is only readable on drop). */
export const isItemDrag = (event: React.DragEvent): boolean =>
  event.dataTransfer.types.includes(ITEM_DRAG_TYPE);

export function getDragItem(event: React.DragEvent): string | null {
  return event.dataTransfer.getData(ITEM_DRAG_TYPE) || null;
}
