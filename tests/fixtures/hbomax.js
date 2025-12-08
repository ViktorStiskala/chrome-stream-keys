/**
 * HBO Max DOM fixture generator
 * Creates a mock DOM structure matching the real HBO Max player
 * 
 * Uses data-testid attributes which are stable across locales
 */

/**
 * Creates the HBO Max player container structure
 * @returns {HTMLElement} The player container element
 */
export function createPlayerContainer() {
  const container = document.createElement('div');
  container.setAttribute('data-testid', 'playerContainer');
  container.className = 'PlayerRootContainer';
  return container;
}

/**
 * Creates the overlay root element used for focus management
 * @returns {HTMLElement} The overlay root element
 */
export function createOverlayRoot() {
  const overlay = document.createElement('div');
  overlay.id = 'overlay-root';
  overlay.setAttribute('data-testid', 'overlay-root');
  overlay.setAttribute('tabindex', '0');
  return overlay;
}

/**
 * Creates the app root container
 * @returns {HTMLElement} The app root element
 */
export function createAppRoot() {
  const appRoot = document.createElement('div');
  appRoot.id = 'app-root';
  return appRoot;
}

/**
 * Creates a play/pause button
 * @returns {HTMLButtonElement} The play/pause button
 */
export function createPlayPauseButton() {
  const button = document.createElement('button');
  button.setAttribute('data-testid', 'player-ux-play-pause-button');
  button.setAttribute('aria-label', 'Play');
  button.setAttribute('title', 'Play (Space)');
  return button;
}

/**
 * Creates a fullscreen button
 * @returns {HTMLButtonElement} The fullscreen button
 */
export function createFullscreenButton() {
  const button = document.createElement('button');
  button.setAttribute('data-testid', 'player-ux-fullscreen-button');
  button.setAttribute('aria-label', 'Full Screen');
  button.setAttribute('title', 'Full Screen (F)');
  return button;
}

/**
 * Creates subtitle track buttons
 * @param {Array<{label: string, checked?: boolean}>} tracks - Array of track configurations
 * @returns {HTMLElement} Container with subtitle buttons
 */
export function createSubtitleButtons(tracks = [
  { label: 'Off', checked: true },
  { label: 'English', checked: false },
  { label: 'Czech', checked: false }
]) {
  const container = document.createElement('div');
  container.className = 'TracksContainer';
  
  const list = document.createElement('ul');
  list.setAttribute('role', 'radiogroup');
  
  tracks.forEach((track) => {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.setAttribute('data-testid', 'player-ux-text-track-button');
    button.setAttribute('aria-label', track.label);
    button.setAttribute('aria-checked', track.checked ? 'true' : 'false');
    button.setAttribute('role', 'radio');
    
    const label = document.createElement('p');
    label.className = 'TrackLabel';
    label.textContent = track.label;
    button.appendChild(label);
    
    li.appendChild(button);
    list.appendChild(li);
  });
  
  container.appendChild(list);
  return container;
}

/**
 * Creates a complete HBO Max player DOM structure
 * @param {Object} options - Configuration options
 * @param {Array} options.subtitleTracks - Subtitle track configurations
 * @returns {Object} Object containing all created elements
 */
export function createHBOMaxDOM(options = {}) {
  const appRoot = createAppRoot();
  const playerContainer = createPlayerContainer();
  const overlayRoot = createOverlayRoot();
  const playPauseButton = createPlayPauseButton();
  const fullscreenButton = createFullscreenButton();
  const subtitleButtons = createSubtitleButtons(options.subtitleTracks);
  
  // Build the structure
  const controlsFooter = document.createElement('div');
  controlsFooter.className = 'ControlsFooterBottomMiddle';
  controlsFooter.appendChild(playPauseButton);
  
  const controlsRight = document.createElement('div');
  controlsRight.className = 'ControlsFooterBottomRight';
  controlsRight.appendChild(fullscreenButton);
  
  overlayRoot.appendChild(controlsFooter);
  overlayRoot.appendChild(controlsRight);
  overlayRoot.appendChild(subtitleButtons);
  
  playerContainer.appendChild(overlayRoot);
  appRoot.appendChild(playerContainer);
  
  document.body.appendChild(appRoot);
  
  return {
    appRoot,
    playerContainer,
    overlayRoot,
    playPauseButton,
    fullscreenButton,
    subtitleButtons,
    getSubtitleButtonElements: () => 
      document.querySelectorAll('button[data-testid="player-ux-text-track-button"]')
  };
}

/**
 * Cleans up the HBO Max DOM fixture
 */
export function cleanupHBOMaxDOM() {
  const appRoot = document.getElementById('app-root');
  if (appRoot) {
    appRoot.remove();
  }
}

