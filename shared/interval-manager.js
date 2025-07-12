// Carmack-style interval manager - prevents resource leaks
const intervals = new Set();
const timeouts = new Set();

const safeInterval = (fn, ms) => {
  const id = setInterval(fn, ms);
  intervals.add(id);
  return id;
};

const safeTimeout = (fn, ms) => {
  const id = setTimeout(fn, ms);
  timeouts.add(id);
  return id;
};

const clearSafeInterval = (id) => {
  clearInterval(id);
  intervals.delete(id);
};

const clearSafeTimeout = (id) => {
  clearTimeout(id);
  timeouts.delete(id);
};

const cleanup = () => {
  intervals.forEach(clearInterval);
  timeouts.forEach(clearTimeout);
  intervals.clear();
  timeouts.clear();
};

// Handle process termination
process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);
process.on('exit', cleanup);

module.exports = { 
  safeInterval, 
  safeTimeout, 
  clearSafeInterval, 
  clearSafeTimeout,
  cleanup 
};