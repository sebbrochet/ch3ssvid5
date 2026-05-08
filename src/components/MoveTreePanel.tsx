import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { MoveNode } from '../types';
import type { OpeningInfo } from '../utils/openingLookup';
import { formatTimestamp } from '../utils/moveTree';
import './MoveTreePanel.css';

interface Props {
  tree: MoveNode | null;
  currentNodeId: string | null;
  onNodeClick: (nodeId: string) => void;
  onStartClick: () => void;
  onDeleteFromHere?: (nodeId: string) => void;
  onPromoteVariation?: (nodeId: string) => void;
  timestamps?: Record<string, number>;
  showTimestamps?: boolean;
  orientation?: 'white' | 'black';
  boardTheme?: string;
  opening?: OpeningInfo | null;
}

function getEffectiveTs(node: MoveNode, timestamps?: Record<string, number>): number | undefined {
  return timestamps?.[node.id] ?? node.timestamp;
}

/** Check if a subtree contains a node with the given ID */
function treeContainsId(node: MoveNode | null, targetId: string): boolean {
  let current = node;
  while (current) {
    if (current.id === targetId) return true;
    for (const v of current.variations) {
      if (treeContainsId(v, targetId)) return true;
    }
    current = current.next;
  }
  return false;
}

/** Collect all variation keys (parent-node-id/vi) in a tree */
function collectVariationKeys(node: MoveNode | null): string[] {
  const keys: string[] = [];
  let current = node;
  while (current) {
    for (let vi = 0; vi < current.variations.length; vi++) {
      const key = `${current.id}/v${vi}`;
      keys.push(key);
      keys.push(...collectVariationKeys(current.variations[vi]));
    }
    current = current.next;
  }
  return keys;
}

/** Format eval for display: +0.54, -1.3, #5, #-3 */
function formatEval(evalStr: string): string {
  if (evalStr.startsWith('#')) return evalStr; // mate
  const num = parseFloat(evalStr);
  if (isNaN(num)) return evalStr;
  return num > 0 ? `+${num.toFixed(1)}` : num.toFixed(1);
}

/** Return CSS class based on eval value */
function evalColor(evalStr: string): string {
  if (evalStr.startsWith('#')) {
    return evalStr.startsWith('#-') ? 'eval-black' : 'eval-white';
  }
  const num = parseFloat(evalStr);
  if (isNaN(num)) return '';
  if (num > 1) return 'eval-white';
  if (num < -1) return 'eval-black';
  return 'eval-equal';
}

/** Render a sequence of moves (a line), stopping at the end or when reaching null */
function MoveLine({
  node,
  currentNodeId,
  onNodeClick,
  onContextMenu,
  onMoveHover,
  timestamps,
  showTimestamps,
  depth,
  activeRef,
  collapsedSet,
  onToggleCollapse,
}: {
  node: MoveNode | null;
  currentNodeId: string | null;
  onNodeClick: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
  onMoveHover: (fen: string | null, rect: DOMRect | null) => void;
  timestamps?: Record<string, number>;
  showTimestamps?: boolean;
  depth: number;
  activeRef: React.RefObject<HTMLSpanElement | null>;
  collapsedSet: Set<string>;
  onToggleCollapse: (key: string) => void;
}) {
  if (!node) return null;

  const elements: React.ReactNode[] = [];
  let current: MoveNode | null = node;
  let needsMoveNumber = true;

  while (current) {
    const n: MoveNode = current;
    const isActive = n.id === currentNodeId;

    // Move number
    if (n.color === 'w') {
      elements.push(
        <span key={`mn-${n.id}`} className="tree-move-number">
          {n.moveNumber}.
        </span>,
      );
      needsMoveNumber = false;
    } else if (needsMoveNumber) {
      elements.push(
        <span key={`mn-${n.id}`} className="tree-move-number">
          {n.moveNumber}...
        </span>,
      );
      needsMoveNumber = false;
    }

    // The move itself
    elements.push(
      <span
        key={`m-${n.id}`}
        ref={isActive ? (activeRef as React.RefObject<HTMLSpanElement>) : null}
        className={`tree-move ${isActive ? 'active' : ''} ${depth > 0 ? 'variation-move' : ''}`}
        onClick={() => onNodeClick(n.id)}
        onContextMenu={(e) => onContextMenu(e, n.id)}
        onMouseEnter={(e) => {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          onMoveHover(n.fen, rect);
        }}
        onMouseLeave={() => onMoveHover(null, null)}
        title={n.comment || undefined}
      >
        {n.san}
        {n.nags?.map((nag: string, i: number) => (
          <span key={i} className="tree-nag">
            {nag}
          </span>
        ))}
        {n.eval && <span className={`tree-eval ${evalColor(n.eval)}`}>{formatEval(n.eval)}</span>}
        {showTimestamps && (
          <span className={`tree-ts ${getEffectiveTs(n, timestamps) !== undefined ? '' : 'missing'}`}>
            {getEffectiveTs(n, timestamps) !== undefined ? formatTimestamp(getEffectiveTs(n, timestamps)!) : '—'}
          </span>
        )}
      </span>,
    );

    // Comment (if any, shown inline — truncated for long ones)
    if (n.comment) {
      const displayComment = n.comment.length > 40 ? n.comment.substring(0, 40) + '…' : n.comment;
      elements.push(
        <span key={`c-${n.id}`} className="tree-comment" title={n.comment}>
          {displayComment}
        </span>,
      );
    }

    // Render variations as indented blocks (collapsible)
    if (n.variations.length > 0) {
      for (let vi = 0; vi < n.variations.length; vi++) {
        const varKey = `${n.id}/v${vi}`;
        const varNode = n.variations[vi];
        const isCollapsed = collapsedSet.has(varKey);
        // Auto-expand if active node is inside this variation
        const containsActive = currentNodeId ? treeContainsId(varNode, currentNodeId) : false;
        const effectiveCollapsed = isCollapsed && !containsActive;

        elements.push(
          <div
            key={`v-${n.id}-${vi}`}
            className={`tree-variation depth-${Math.min(depth + 1, 3)}${effectiveCollapsed ? ' collapsed' : ''}`}
          >
            <span
              className="tree-fold-toggle"
              onClick={(e) => {
                e.stopPropagation();
                onToggleCollapse(varKey);
              }}
              title={effectiveCollapsed ? 'Expand' : 'Collapse'}
            >
              {effectiveCollapsed ? '▸' : '▾'}
            </span>
            {effectiveCollapsed ? (
              <span className="tree-collapsed-preview" onClick={() => onToggleCollapse(varKey)}>
                {varNode.color === 'w' ? `${varNode.moveNumber}. ` : `${varNode.moveNumber}... `}
                {varNode.san} …
              </span>
            ) : (
              <MoveLine
                node={varNode}
                currentNodeId={currentNodeId}
                onNodeClick={onNodeClick}
                onContextMenu={onContextMenu}
                onMoveHover={onMoveHover}
                timestamps={timestamps}
                showTimestamps={showTimestamps}
                depth={depth + 1}
                activeRef={activeRef}
                collapsedSet={collapsedSet}
                onToggleCollapse={onToggleCollapse}
              />
            )}
          </div>,
        );
      }
      // After variations, re-emit move number for the continuation
      needsMoveNumber = true;
    }

    current = n.next;
  }

  return <>{elements}</>;
}

export function MoveTreePanel({
  tree,
  currentNodeId,
  onNodeClick,
  onStartClick,
  onDeleteFromHere,
  onPromoteVariation,
  timestamps,
  showTimestamps,
  orientation = 'white',
  boardTheme,
  opening,
}: Props) {
  const { t } = useTranslation();
  const activeRef = useRef<HTMLSpanElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);
  const [collapsedSet, setCollapsedSet] = useState<Set<string>>(new Set());

  const toggleCollapse = useCallback((key: string) => {
    setCollapsedSet((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const collapseAll = useCallback(() => {
    if (!tree) return;
    setCollapsedSet(new Set(collectVariationKeys(tree)));
  }, [tree]);

  const expandAll = useCallback(() => {
    setCollapsedSet(new Set());
  }, []);

  // Check if there are any variations to fold
  const hasVariations = tree ? collectVariationKeys(tree).length > 0 : false;

  // Miniboard tooltip state
  const [hoverInfo, setHoverInfo] = useState<{ fen: string; x: number; y: number } | null>(null);
  const miniBoardRef = useRef<HTMLDivElement>(null);
  const miniCgRef = useRef<Api | null>(null);

  const handleMoveHover = useCallback((fen: string | null, rect: DOMRect | null) => {
    if (!fen || !rect || !containerRef.current) {
      setHoverInfo(null);
      return;
    }
    const containerRect = containerRef.current.getBoundingClientRect();
    // Position tooltip below the move
    const x = rect.left - containerRect.left;
    const y = rect.bottom - containerRect.top + containerRef.current.scrollTop;
    setHoverInfo({ fen, x, y });
  }, []);

  // Initialize/update miniboard
  useEffect(() => {
    if (!hoverInfo || !miniBoardRef.current) {
      return;
    }
    if (!miniCgRef.current) {
      miniCgRef.current = Chessground(miniBoardRef.current, {
        fen: hoverInfo.fen,
        orientation,
        coordinates: false,
        viewOnly: true,
        movable: { free: false },
        draggable: { enabled: false },
        selectable: { enabled: false },
        animation: { enabled: false },
        drawable: { enabled: false },
      });
    } else {
      miniCgRef.current.set({ fen: hoverInfo.fen, orientation });
    }
  }, [hoverInfo, orientation]);

  // Destroy miniboard when tooltip hides
  useEffect(() => {
    if (!hoverInfo && miniCgRef.current) {
      miniCgRef.current.destroy();
      miniCgRef.current = null;
    }
  }, [hoverInfo]);

  // Auto-scroll to active move (within the panel only, not the whole page)
  useEffect(() => {
    if (activeRef.current && containerRef.current) {
      const container = containerRef.current;
      const el = activeRef.current;
      const elTop = el.offsetTop;
      const elBottom = elTop + el.offsetHeight;
      const viewTop = container.scrollTop;
      const viewBottom = viewTop + container.clientHeight;

      // Only scroll if the element is outside the visible area
      if (elTop < viewTop) {
        container.scrollTop = elTop - 8;
      } else if (elBottom > viewBottom) {
        container.scrollTop = elBottom - container.clientHeight + 8;
      }
    }
  }, [currentNodeId]);

  // Close context menu on click anywhere
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [contextMenu]);

  const handleContextMenu = (e: React.MouseEvent, nodeId: string) => {
    if (!onDeleteFromHere && !onPromoteVariation) return;
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, nodeId });
  };

  const handleDelete = () => {
    if (contextMenu && onDeleteFromHere) {
      onDeleteFromHere(contextMenu.nodeId);
    }
    setContextMenu(null);
  };

  const handlePromote = () => {
    if (contextMenu && onPromoteVariation) {
      onPromoteVariation(contextMenu.nodeId);
    }
    setContextMenu(null);
  };

  // Check if a node is a variation head (its ID contains /v)
  const isVariationNode = contextMenu ? contextMenu.nodeId.includes('/v') : false;

  return (
    <div className="move-tree-panel" ref={containerRef}>
      {tree && (
        <div className="tree-header">
          <span className={`tree-start ${currentNodeId === null ? 'active' : ''}`} onClick={onStartClick}>
            {t('moveTree.start')}
          </span>
          {opening && (
            <span className="tree-opening">
              <span className="tree-opening-eco">{opening.eco}</span>
              <span className="tree-opening-name">{opening.name}</span>
            </span>
          )}
          {hasVariations && (
            <span className="tree-fold-actions">
              <button
                className="tree-fold-btn"
                onClick={collapseAll}
                title={t('moveTree.collapseAll', 'Collapse all variations')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M7.41 18.59 8.83 20 12 16.83 15.17 20l1.41-1.41L12 14zm9.18-13.18L15.17 4 12 7.17 8.83 4 7.41 5.41 12 10z"
                  />
                </svg>
              </button>
              <button
                className="tree-fold-btn"
                onClick={expandAll}
                title={t('moveTree.expandAll', 'Expand all variations')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M12 5.83 15.17 9l1.41-1.41L12 3 7.41 7.59 8.83 9zm0 12.34L8.83 15l-1.41 1.41L12 21l4.59-4.59L15.17 15z"
                  />
                </svg>
              </button>
            </span>
          )}
        </div>
      )}
      <div className="tree-moves">
        <MoveLine
          node={tree}
          currentNodeId={currentNodeId}
          onNodeClick={onNodeClick}
          onContextMenu={handleContextMenu}
          onMoveHover={handleMoveHover}
          timestamps={timestamps}
          showTimestamps={showTimestamps}
          depth={0}
          activeRef={activeRef}
          collapsedSet={collapsedSet}
          onToggleCollapse={toggleCollapse}
        />
      </div>
      {hoverInfo && (
        <div
          className="miniboard-tooltip"
          data-board-theme={boardTheme || 'brown'}
          style={{
            top: hoverInfo.y + 4,
            left: Math.max(0, hoverInfo.x - 60),
          }}
        >
          <div className="miniboard" ref={miniBoardRef} />
        </div>
      )}
      {contextMenu && (
        <div className="tree-context-menu" style={{ top: contextMenu.y, left: contextMenu.x }}>
          {onDeleteFromHere && <button onClick={handleDelete}>{t('moveTree.deleteFromHere')}</button>}
          {onPromoteVariation && isVariationNode && (
            <button onClick={handlePromote}>{t('moveTree.makeMainLine')}</button>
          )}
        </div>
      )}
    </div>
  );
}
