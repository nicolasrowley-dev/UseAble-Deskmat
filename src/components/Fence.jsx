// ─── Fence (Desktop Group Container) ───
// A transparent, draggable, resizable grouping region.
// Files positioned inside a fence move with it when dragged.

import { useState } from 'react';

export function Fence({ fence, fileCount, onDragStart, onTouchDragStart, onToggleRollUp, onRemoveFence, onRenameFence, onResizeStart }) {
  const [titleHover, setTitleHover] = useState(false);

  return (
    <div
      onMouseDown={(e) => { if (e.target.dataset.resize) return; onDragStart(e, fence.id); }}
      onTouchStart={(e) => { if (e.target.dataset.resize) return; onTouchDragStart(e, fence.id); }}
      style={{
        position: 'absolute',
        left: fence.x, top: fence.y,
        width: fence.w,
        height: fence.rolledUp ? 36 : fence.h,
        background: 'rgba(0,0,0,0.25)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 10,
        overflow: 'hidden',
        zIndex: 2,
        transition: 'height 0.25s ease',
        cursor: 'move',
        touchAction: 'none',
      }}
    >
      {/* Title bar */}
      <div
        onMouseEnter={() => setTitleHover(true)}
        onMouseLeave={() => setTitleHover(false)}
        style={{
          height: 34,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 10px',
          background: 'rgba(255,255,255,0.06)',
          borderBottom: fence.rolledUp ? 'none' : '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 600 }}>
          {fence.name}{' '}
          <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 400 }}>({fileCount})</span>
        </span>
        <div style={{ display: 'flex', gap: 4, opacity: titleHover ? 1 : 0.4, transition: 'opacity 0.15s' }}>
          <FenceButton label="✎" onClick={(e) => { e.stopPropagation(); onRenameFence(fence.id); }} />
          <FenceButton label={fence.rolledUp ? '▼' : '▲'} onClick={(e) => { e.stopPropagation(); onToggleRollUp(fence.id); }} />
          <FenceButton label="✕" onClick={(e) => { e.stopPropagation(); onRemoveFence(fence.id); }} />
        </div>
      </div>

      {/* Resize handle */}
      {!fence.rolledUp && (
        <div
          data-resize="true"
          onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e, fence.id); }}
          style={{
            position: 'absolute', bottom: 0, right: 0, width: 24, height: 24,
            cursor: 'se-resize', zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" style={{ opacity: 0.3 }}>
            <line x1="9" y1="1" x2="1" y2="9" stroke="white" strokeWidth="1.2"/>
            <line x1="9" y1="5" x2="5" y2="9" stroke="white" strokeWidth="1.2"/>
          </svg>
        </div>
      )}
    </div>
  );
}

function FenceButton({ label, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 24, height: 24, borderRadius: 5,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: hover ? 'rgba(255,255,255,0.15)' : 'transparent',
        color: 'rgba(255,255,255,0.7)', fontSize: 11, cursor: 'pointer',
      }}
    >
      {label}
    </div>
  );
}
