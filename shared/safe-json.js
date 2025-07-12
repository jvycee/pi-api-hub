// Carmack-style safe JSON - never crash, always return something useful
const safeParse = (str, fallback = null) => {
  try { return JSON.parse(str); } 
  catch { return fallback; }
};

const safeStringify = (obj, fallback = '{}') => {
  try { return JSON.stringify(obj); } 
  catch { return fallback; }
};

module.exports = { safeParse, safeStringify };