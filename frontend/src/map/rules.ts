// Copies of the game rules in backend application.yml (kindred.*), used for drawing only.
// The backend enforces them; if the team changes a value there, change it here too.

/** kindred.node.max-children */
export const MAX_CHILDREN = 2;

/** kindred.node.open-hours: how long a node accepts children after it's created. */
export const OPEN_HOURS = 12;

/** kindred.continue-rules.max-distance-meters: claim radius shown on the map. */
export const JOIN_RADIUS_M = 2000;

/** kindred.privacy.grid-meters: pins can sit up to about this far from the real spot. */
export const PRIVACY_GRID_M = 250;
