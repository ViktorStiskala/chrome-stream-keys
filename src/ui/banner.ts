// Banner notification utility

import { cssVars } from './styles/variables';

const BANNER_ID = 'streamkeys-banner';
let bannerTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Show a temporary banner notification overlay
 */
export function showBanner(message: string): void {
  // Remove existing banner
  const existing = document.getElementById(BANNER_ID);
  if (existing) {
    existing.remove();
    if (bannerTimeout) {
      clearTimeout(bannerTimeout);
    }
  }

  const banner = document.createElement('div');
  banner.id = BANNER_ID;
  banner.textContent = message;
  banner.style.cssText = `
    position: fixed;
    bottom: 25%;
    left: 50%;
    transform: translateX(-50%);
    background: ${cssVars.overlay.bgLight};
    color: ${cssVars.text.primary};
    padding: ${cssVars.spacing.xl} 40px;
    border-radius: ${cssVars.borderRadius.xl};
    font-family: ${cssVars.font.family};
    font-size: ${cssVars.font.sizeXXLarge};
    font-weight: 600;
    z-index: ${cssVars.zIndex.max};
    pointer-events: none;
    opacity: 1;
    transition: opacity 0.3s ease-out;
  `;

  document.body.appendChild(banner);

  // Fade out after delay
  bannerTimeout = setTimeout(() => {
    banner.style.opacity = '0';
    setTimeout(() => banner.remove(), cssVars.timing.fadeTransition);
  }, cssVars.timing.bannerFade);
}

/**
 * Clean up banner resources
 */
export function cleanupBanner(): void {
  const existing = document.getElementById(BANNER_ID);
  if (existing) {
    existing.remove();
  }
  if (bannerTimeout) {
    clearTimeout(bannerTimeout);
    bannerTimeout = null;
  }
}
