// Restore Position dialog styles

import { cssVars } from '@/ui/styles/variables';

export const dialogStyles = {
  container: `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: ${cssVars.overlay.bg};
    color: ${cssVars.text.primary};
    padding: ${cssVars.spacing.xxl} 32px;
    border-radius: ${cssVars.borderRadius.xxl};
    font-family: ${cssVars.font.family};
    z-index: ${cssVars.zIndex.max};
    min-width: 300px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  `,

  header: `
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: ${cssVars.spacing.lg};
  `,

  title: `
    font-size: ${cssVars.font.sizeXLarge};
    font-weight: 600;
  `,

  closeButton: `
    background: transparent;
    border: none;
    color: ${cssVars.text.secondary};
    font-size: 26px;
    cursor: pointer;
    padding: 0;
    line-height: 1;
    margin-top: -5px;
    transition: color 0.2s;
  `,

  currentTimeContainer: `
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: ${cssVars.spacing.md} ${cssVars.spacing.lg};
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid ${cssVars.overlay.borderLight};
    border-radius: ${cssVars.borderRadius.lg};
    margin-bottom: ${cssVars.spacing.sm};
  `,

  currentTimeLabel: `
    font-size: ${cssVars.font.sizeMedium};
    color: ${cssVars.text.secondary};
  `,

  currentTimeValue: `
    font-size: ${cssVars.font.sizeLarge};
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  `,

  list: `
    display: flex;
    flex-direction: column;
    gap: ${cssVars.spacing.sm};
  `,

  positionItem: `
    position: relative;
    display: flex;
    align-items: center;
    gap: ${cssVars.spacing.md};
    padding: ${cssVars.spacing.md} ${cssVars.spacing.lg} ${cssVars.spacing.lg} ${cssVars.spacing.lg};
    background: ${cssVars.overlay.bgActive};
    border: 1px solid ${cssVars.overlay.border};
    border-radius: ${cssVars.borderRadius.lg};
    color: ${cssVars.text.primary};
    font-size: ${cssVars.font.sizeLarge};
    cursor: pointer;
    transition: background 0.2s;
    text-align: left;
    overflow: hidden;
  `,

  keyHint: `
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: ${cssVars.overlay.border};
    border-radius: ${cssVars.borderRadius.sm};
    font-size: ${cssVars.font.sizeMedium};
    font-weight: 600;
    flex-shrink: 0;
  `,

  timeLabel: `
    flex: 1;
    font-variant-numeric: tabular-nums;
  `,

  relativeTime: `
    font-size: ${cssVars.font.sizeSmall};
    color: ${cssVars.text.muted};
    flex-shrink: 0;
  `,

  progressBar: `
    position: absolute;
    bottom: ${cssVars.spacing.xs};
    left: ${cssVars.spacing.lg};
    right: ${cssVars.spacing.lg};
    height: 3px;
    background: ${cssVars.progress.bg};
    border-radius: 2px;
    overflow: hidden;
  `,

  progressFill: `
    height: 100%;
    background: ${cssVars.progress.fill};
    border-radius: 2px;
  `,

  separator: `
    height: 1px;
    background: linear-gradient(
      to right,
      rgba(255,255,255,0) 0,
      rgba(255,255,255,0.15) 24px,
      rgba(255,255,255,0.15) calc(100% - 24px),
      rgba(255,255,255,0) 100%
    );
    margin: ${cssVars.spacing.xs} -20px;
  `,

  hint: `
    font-size: ${cssVars.font.sizeSmall};
    color: ${cssVars.text.muted};
    margin-top: ${cssVars.spacing.lg};
    text-align: center;
  `,
} as const;
