// Placeholder SVG images for thumbnail loading states
// These are lightweight (~500 bytes each) compared to full base64 images (12MB+)

export const PLACEHOLDER_LOADING = `data:image/svg+xml;base64,${btoa(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <rect fill="#222" width="100" height="100"/>
  <circle cx="50" cy="50" r="15" fill="none" stroke="#666" stroke-width="3" stroke-dasharray="70" stroke-linecap="round">
    <animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="1s" repeatCount="indefinite"/>
  </circle>
</svg>
`)}`;

export const PLACEHOLDER_ERROR = `data:image/svg+xml;base64,${btoa(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <rect fill="#2a1a1a" width="100" height="100"/>
  <path d="M50 30 L50 55 M50 65 L50 70" stroke="#ff4444" stroke-width="4" stroke-linecap="round"/>
  <circle cx="50" cy="50" r="30" fill="none" stroke="#ff4444" stroke-width="3"/>
</svg>
`)}`;

export const PLACEHOLDER_BLANK = `data:image/svg+xml;base64,${btoa(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <rect fill="#1a1a1a" width="100" height="100"/>
  <rect x="20" y="35" width="60" height="30" rx="8" fill="#2c2c2c" stroke="#3a3a3a" stroke-width="2"/>
</svg>
`)}`;
