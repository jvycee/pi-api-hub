// Carmack-style log sanitizer - minimal, fast, effective
const sanitizeForLogging = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  
  const sensitive = ['password', 'token', 'key', 'secret', 'authorization', 'api_key', 'apikey'];
  const clean = Array.isArray(obj) ? [] : {};
  
  for (const [k, v] of Object.entries(obj)) {
    const isSensitive = sensitive.some(s => k.toLowerCase().includes(s));
    clean[k] = isSensitive ? '[REDACTED]' : 
               (typeof v === 'object' ? sanitizeForLogging(v) : v);
  }
  
  return clean;
};

module.exports = { sanitizeForLogging };