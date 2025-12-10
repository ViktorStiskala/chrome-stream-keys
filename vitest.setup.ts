import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Load a DOM fixture from resources/dom/ into the document
 */
export function loadFixture(name: 'disney' | 'hbomax'): void {
  const html = readFileSync(resolve(__dirname, `resources/dom/${name}.html`), 'utf-8');
  document.documentElement.innerHTML = html;
}

/**
 * Reset the document to a clean state
 */
export function resetFixture(): void {
  document.documentElement.innerHTML = '';
  document.documentElement.removeAttribute('data-streamkeys-disney');
  document.documentElement.removeAttribute('data-streamkeys-hbomax');
}

/**
 * Create a mock progress-bar element with Shadow DOM for Disney+ tests
 */
export function createMockProgressBar(valuenow?: string, valuemax?: string): HTMLElement {
  const progressBar = document.createElement('progress-bar');

  // Attach shadow DOM
  const shadow = progressBar.attachShadow({ mode: 'open' });

  // Create thumb element
  const thumb = document.createElement('div');
  thumb.className = 'progress-bar__thumb';

  if (valuenow !== undefined) {
    thumb.setAttribute('aria-valuenow', valuenow);
  }
  if (valuemax !== undefined) {
    thumb.setAttribute('aria-valuemax', valuemax);
  }

  shadow.appendChild(thumb);
  document.body.appendChild(progressBar);

  return progressBar;
}

