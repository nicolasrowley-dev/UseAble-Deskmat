// ─── Context Menu ───
// Renders right-click / long-press menus with icons, dividers, and labels.

import { useState } from 'react';

export function ContextMenu({ x, y, items }) {
  // Keep menu within viewport
  const adjustedY = Math.min(y, window.innerHeight - items.length * 34 - 20);
  const adjustedX = Math.min(x, window.innerWidth - 200);

  return (
    <div style={{
      position: 'fixed', left: adjustedX, top: adjustedY,
      background: 'rgba(26,26,38,0.96)', backdropFilter: 'blur(24px)',
      border: '1px solid rgba(255,255,255,0.13)', borderRadius: 10,
      padding: '5px 0', minWidth: 190, zIndex: 9999,
      boxShadow: '0 10px 40px rgba(0,0,0,0.55)',
    }}>
      {items.map((item, i) => {
        if (item.type === 'divider') {
          return <div key={i} style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 12px' }} />;
        }
        if (item.type === 'label') {
          return (
            <div key={i} style={{ padding: '5px 16px', color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {item.text}
            </div>
          );
        }
        return <ContextMenuItem key={i} {...item} />;
      })}
    </div>
  );
}

function ContextMenuItem({ label, icon, onClick, disabled }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 10,
        color: disabled ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.85)',
        fontSize: 13, cursor: disabled ? 'default' : 'pointer',
        background: hover && !disabled ? 'rgba(255,255,255,0.08)' : 'transparent',
      }}
    >
      {icon && <span style={{ width: 16, textAlign: 'center', fontSize: 14, opacity: 0.7 }}>{icon}</span>}
      <span style={{ flex: 1 }}>{label}</span>
    </div>
  );
}
