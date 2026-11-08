// Copies of the game rules in backend application.yml (kindred.*), used for drawing only.
// The backend enforces them; if the team changes a value there, change it here too.

/** kindred.node.max-children */
export const MAX_CHILDREN = 2;

/** kindred.continue-rules.max-distance-meters: how close you must be to join a node. */
export const JOIN_RADIUS_M = 2000;

/** kindred.privacy.grid-meters: pins can sit up to about this far from the real spot. */
export const PRIVACY_GRID_M = 250;
