let dirty = false;
export const setDirty = (v: boolean) => { dirty = v; };
export const isDirty = () => dirty;
export function confirmDiscard(): boolean {
  return !dirty || window.confirm('You have unsaved changes. Discard them?');
}
