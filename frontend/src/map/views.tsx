import type { StyleProp, ViewStyle } from 'react-native';

import type { ChainTree } from '@/api/types';

import { ChainMap, type BusinessPin } from './ChainMap';
import { descendants, lineage } from './graph';

// One component per map view. Screens pass data in and get taps back; the maps never
// navigate, and any buttons for switching views belong to the screen, not here.
// (JoinMap, the "find a node to join" view, lives in JoinMap.tsx.)

type TapProps = {
  /** Called with the tapped node's id. What happens next is the screen's call. */
  onNodePress?: (id: number) => void;
  style?: StyleProp<ViewStyle>;
};

/** My kindness: everything that grew out of my latest act. */
export function MyKindnessMap({
  tree,
  latestNodeId,
  businesses,
  onBusinessPress,
  onNodePress,
  style,
}: TapProps & {
  tree: ChainTree;
  latestNodeId: number;
  businesses?: BusinessPin[];
  onBusinessPress?: (id: number) => void;
}) {
  return (
    <ChainMap
      nodes={descendants(tree.nodes, latestNodeId)}
      focusId={latestNodeId}
      businesses={businesses}
      onBusinessPress={onBusinessPress}
      onNodePress={onNodePress}
      style={style}
    />
  );
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
