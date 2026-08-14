const subscribers = new Map();

function subscribe(gameCode, response) {
  const listeners = subscribers.get(gameCode) || new Set();
  listeners.add(response);
  subscribers.set(gameCode, listeners);
  return () => {
    listeners.delete(response);
    if (listeners.size === 0) subscribers.delete(gameCode);
  };
}

function publish(gameCode, version) {
  const payload = `event: refresh\ndata: ${JSON.stringify({ version })}\n\n`;
  for (const response of subscribers.get(gameCode) || []) {
    try {
      response.write(payload);
    } catch {
      // The close handler removes unavailable connections.
    }
  }
}

module.exports = { subscribe, publish };
