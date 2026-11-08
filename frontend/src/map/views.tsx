import type { StyleProp, ViewStyle } from 'react-native';

import type { ChainTree } from '@/api/types';

import { ChainMap } from './ChainMap';
import { descendants, lineage } from './graph';

// One component per map view. Screens pass data in and get taps back; the maps never
// navigate, and any buttons for switching views belong to the screen, not here.
// Each view zooms itself to fit everything it shows when it opens.
// (JoinMap, the "find a node to join" view, lives in JoinMap.tsx.)

type TapProps = {
  /** Handle taps yourself (e.g. navigate). Leave it out and the map opens the act's card. */
  onNodePress?: (id: number) => void;
  style?: StyleProp<ViewStyle>;
};

/** My kindness: only my latest act and everything that grew out of it. No businesses. */
export function MyKindnessMap({ tree, latestNodeId, onNodePress, style }: TapProps & { tree: ChainTree; latestNodeId: number }) {
  return <ChainMap nodes={descendants(tree.nodes, latestNodeId)} focusId={latestNodeId} onNodePress={onNodePress} style={style} />;
}

/** Full chain: every act above the node (back to the start) and every act below it. */
export function FullChainMap({ tree, nodeId, onNodePress, style }: TapProps & { tree: ChainTree; nodeId: number }) {
  return <ChainMap nodes={lineage(tree.nodes, nodeId)} focusId={nodeId} onNodePress={onNodePress} style={style} />;
}

/** Weekly recap, longest chains: one straight start-to-end line through my acts. */
export function RecapChainMap({ chain, onNodePress, style }: TapProps & { chain: ChainTree }) {
  return <ChainMap nodes={chain.nodes} onNodePress={onNodePress} style={style} />;
}

/** Weekly recap, biggest nets: a whole branching tree containing my acts. */
export function RecapNetMap({ net, onNodePress, style }: TapProps & { net: ChainTree }) {
  return <ChainMap nodes={net.nodes} onNodePress={onNodePress} style={style} />;
}
