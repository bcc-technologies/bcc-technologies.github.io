/* Stable public facade for the modular workspace visual library. */
(() => {
  const library = window.BCCWorkspaceUILibrary;
  if (!library) throw new Error("Workspace UI registry must load before the public facade.");
  window.BCCWorkspaceUI = library.compose([
    "foundation",
    "content",
    "states",
    "interactions"
  ]);
})();
