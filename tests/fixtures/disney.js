/**
 * Disney+ DOM fixture generator
 * Creates a mock DOM structure matching the real Disney+ player
 * 
 * Disney+ uses Shadow DOM for player controls, which requires special mocking
 */

/**
 * Creates a mock Shadow Root with querySelector support
 * @param {HTMLElement} host - The host element
 * @returns {Object} Mock shadow root object
 */
function createMockShadowRoot(host) {
  const shadowContent = document.createElement('div');
  shadowContent.className = 'shadow-content';
  
  const shadowRoot = {
    _content: shadowContent,
    querySelector: (selector) => shadowContent.querySelector(selector),
    querySelectorAll: (selector) => shadowContent.querySelectorAll(selector),
    appendChild: (child) => shadowContent.appendChild(child),
    host: host
  };
  
  return shadowRoot;
}

/**
 * Creates the Disney+ web player element
 * @returns {HTMLElement} The disney-web-player element
 */
export function createDisneyWebPlayer() {
  const player = document.createElement('disney-web-player');
  player.setAttribute('tabindex', '-1');
  return player;
}

/**
 * Creates a Shadow DOM button control element
 * @param {string} selector - The selector name (e.g., 'toggle-play-pause')
 * @returns {Object} Object containing the control element and its shadow root
 */
export function createShadowButton(selector) {
  const control = document.createElement(selector);
  const shadowRoot = createMockShadowRoot(control);
  
  // Create the info-tooltip with button inside shadow DOM
  const infoTooltip = document.createElement('info-tooltip');
  const button = document.createElement('button');
  button.className = 'control-button';
  infoTooltip.appendChild(button);
  shadowRoot.appendChild(infoTooltip);
  
  // Attach mock shadow root to element
  Object.defineProperty(control, 'shadowRoot', {
    value: shadowRoot,
    writable: false,
    configurable: true
  });
  
  return { control, shadowRoot, button };
}

/**
 * Creates the subtitle track picker structure
 * @param {Array<{label: string, id: string, checked?: boolean}>} tracks - Subtitle track configurations
 * @returns {HTMLElement} The subtitle picker container
 */
export function createSubtitlePicker(tracks = [
  { label: 'Off', id: 'subtitleTrackPicker-off', checked: true },
  { label: 'English', id: 'subtitleTrackPicker-en', checked: false },
  { label: 'Czech', id: 'subtitleTrackPicker-cs', checked: false }
]) {
  const picker = document.createElement('div');
  picker.id = 'subtitleTrackPicker';
  
  tracks.forEach((track) => {
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'subtitleTrack';
    input.id = track.id;
    input.checked = track.checked || false;
    
    const label = document.createElement('label');
    label.className = 'picker-item';
    label.setAttribute('for', track.id);
    label.textContent = track.label;
    
    picker.appendChild(input);
    picker.appendChild(label);
  });
  
  return picker;
}

/**
 * Creates a complete Disney+ player DOM structure
 * @param {Object} options - Configuration options
 * @param {Array} options.subtitleTracks - Subtitle track configurations
 * @param {Array} options.controls - Control selectors to create (default: all main controls)
 * @returns {Object} Object containing all created elements
 */
export function createDisneyPlusDOM(options = {}) {
  const player = createDisneyWebPlayer();
  
  // Create video element inside player
  const video = document.createElement('video');
  player.appendChild(video);
  
  // Create control buttons with Shadow DOM
  const controlSelectors = options.controls || [
    'toggle-play-pause',
    'toggle-fullscreen',
    'quick-rewind',
    'quick-fast-forward'
  ];
  
  const controls = {};
  controlSelectors.forEach(selector => {
    const { control, shadowRoot, button } = createShadowButton(selector);
    controls[selector] = { control, shadowRoot, button };
    document.body.appendChild(control);
  });
  
  // Create subtitle picker
  const subtitlePicker = createSubtitlePicker(options.subtitleTracks);
  
  // Add elements to document
  document.body.appendChild(player);
  document.body.appendChild(subtitlePicker);
  
  return {
    player,
    video,
    controls,
    subtitlePicker,
    getOffRadio: () => document.querySelector('#subtitleTrackPicker-off'),
    getSubtitleLabels: () => document.querySelectorAll('#subtitleTrackPicker label.picker-item'),
    getShadowButton: (selector) => {
      const element = document.body.querySelector(selector);
      return element?.shadowRoot?.querySelector('info-tooltip button');
    }
  };
}

/**
 * Cleans up the Disney+ DOM fixture
 */
export function cleanupDisneyPlusDOM() {
  const player = document.body.querySelector('disney-web-player');
  if (player) player.remove();
  
  const picker = document.getElementById('subtitleTrackPicker');
  if (picker) picker.remove();
  
  // Remove control elements
  ['toggle-play-pause', 'toggle-fullscreen', 'quick-rewind', 'quick-fast-forward'].forEach(selector => {
    const element = document.body.querySelector(selector);
    if (element) element.remove();
  });
}

