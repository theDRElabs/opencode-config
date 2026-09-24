// Anti-detection init script
Object.defineProperty(navigator, 'webdriver', { get: () => false });

// Remove automation-related Chrome flags
const originalQuery = window.navigator.permissions.query;
window.navigator.permissions.query = (parameters) => (
  parameters.name === 'notifications' ?
    Promise.resolve({ state: Notification.permission }) :
    originalQuery(parameters)
);

// Override plugins to look non-headless
Object.defineProperty(navigator, 'plugins', {
  get: () => [1, 2, 3, 4, 5],
});

// Override languages
Object.defineProperty(navigator, 'languages', {
  get: () => ['en-US', 'en'],
});

// Fix chrome object
window.chrome = {
  runtime: {},
  loadTimes: function() {},
  csi: function() {},
  app: {},
};
