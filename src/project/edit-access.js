// Keep every controller command behind the same sign-in rule, including shortcuts
// and forms that were opened before a session expired.
export function guardProjectEdits(actions, canEdit, denied) {
  for (const name of [
    "openProjectDetails", "saveProjectDetails", "saveColorLegend", "openNewDivider", "openDivider",
    "saveDivider", "deleteDivider", "nudgeDivider", "openCrew", "saveCrewMember",
    "archiveCrewMember", "setPlacementLimit", "createSharedProject", "resolveShared", "undo", "redo",
    "beginEdit", "openNew", "openNextBlock", "addBelow", "changeProgress", "setBlocked", "assignPerson",
    "addDependency", "editBlock", "setUncertainty", "setBlockColor", "setSize",
    "unassign", "removeDependency", "reopenBlock", "saveBlock", "deleteBlock", "resetDemo",
  ]) {
    const action = actions[name];
    actions[name] = (...args) => canEdit() ? action(...args) : denied();
  }
  return actions;
}
