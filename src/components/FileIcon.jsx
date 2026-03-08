// ─── File Icon ───
// SVG icons for each supported file type.
// In Phase 3 these will be replaced with real Drive thumbnails.

export function getFileIcon(type, size = 44) {
  const icons = {
    folder: (
      <svg viewBox="0 0 48 48" width={size} height={size}>
        <path d="M4 8h16l4 4h20v28H4z" fill="#FFB74D" stroke="#F57C00" strokeWidth="1.5"/>
        <path d="M4 16h40v24H4z" fill="#FFB74D" rx="2"/>
        <path d="M4 16h40v4H4z" fill="#FFA726"/>
      </svg>
    ),
    document: (
      <svg viewBox="0 0 48 48" width={size} height={size}>
        <path d="M10 4h20l10 10v30H10z" fill="#E3F2FD" stroke="#1E88E5" strokeWidth="1.5"/>
        <path d="M30 4v10h10" fill="#BBDEFB" stroke="#1E88E5" strokeWidth="1.5"/>
        <line x1="16" y1="22" x2="34" y2="22" stroke="#64B5F6" strokeWidth="1.5"/>
        <line x1="16" y1="28" x2="34" y2="28" stroke="#64B5F6" strokeWidth="1.5"/>
        <line x1="16" y1="34" x2="28" y2="34" stroke="#64B5F6" strokeWidth="1.5"/>
      </svg>
    ),
    spreadsheet: (
      <svg viewBox="0 0 48 48" width={size} height={size}>
        <path d="M10 4h20l10 10v30H10z" fill="#E8F5E9" stroke="#43A047" strokeWidth="1.5"/>
        <path d="M30 4v10h10" fill="#C8E6C9" stroke="#43A047" strokeWidth="1.5"/>
        <rect x="15" y="20" width="18" height="4" fill="#66BB6A" rx="0.5"/>
        <rect x="15" y="26" width="18" height="4" fill="#A5D6A7" rx="0.5"/>
        <rect x="15" y="32" width="18" height="4" fill="#66BB6A" rx="0.5"/>
        <line x1="24" y1="20" x2="24" y2="36" stroke="#2E7D32" strokeWidth="0.8"/>
      </svg>
    ),
    presentation: (
      <svg viewBox="0 0 48 48" width={size} height={size}>
        <path d="M10 4h20l10 10v30H10z" fill="#FFF3E0" stroke="#FB8C00" strokeWidth="1.5"/>
        <path d="M30 4v10h10" fill="#FFE0B2" stroke="#FB8C00" strokeWidth="1.5"/>
        <rect x="15" y="20" width="18" height="14" fill="#FFB74D" rx="2"/>
        <circle cx="24" cy="27" r="3" fill="#FFF3E0"/>
      </svg>
    ),
    pdf: (
      <svg viewBox="0 0 48 48" width={size} height={size}>
        <path d="M10 4h20l10 10v30H10z" fill="#FFEBEE" stroke="#E53935" strokeWidth="1.5"/>
        <path d="M30 4v10h10" fill="#FFCDD2" stroke="#E53935" strokeWidth="1.5"/>
        <text x="24" y="32" textAnchor="middle" fill="#C62828" fontSize="10" fontWeight="bold" fontFamily="sans-serif">PDF</text>
      </svg>
    ),
    image: (
      <svg viewBox="0 0 48 48" width={size} height={size}>
        <rect x="8" y="8" width="32" height="32" fill="#F3E5F5" stroke="#8E24AA" strokeWidth="1.5" rx="3"/>
        <circle cx="18" cy="18" r="4" fill="#CE93D8"/>
        <path d="M8 32l8-10 6 6 6-8 12 12H8z" fill="#AB47BC" opacity="0.7"/>
      </svg>
    ),
    text: (
      <svg viewBox="0 0 48 48" width={size} height={size}>
        <path d="M10 4h20l10 10v30H10z" fill="#FAFAFA" stroke="#757575" strokeWidth="1.5"/>
        <path d="M30 4v10h10" fill="#E0E0E0" stroke="#757575" strokeWidth="1.5"/>
        <line x1="16" y1="22" x2="34" y2="22" stroke="#9E9E9E" strokeWidth="1.5"/>
        <line x1="16" y1="28" x2="34" y2="28" stroke="#9E9E9E" strokeWidth="1.5"/>
        <line x1="16" y1="34" x2="26" y2="34" stroke="#9E9E9E" strokeWidth="1.5"/>
      </svg>
    ),
  };
  return icons[type] || icons.document;
}
