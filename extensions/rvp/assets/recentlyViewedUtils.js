window.RecentlyViewedUtils = {
  getCookie(name) {
    const nameEQ = `${name}=`;
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      while (cookie.charAt(0) === ' ') cookie = cookie.substring(1);
      if (cookie.indexOf(nameEQ) === 0) return cookie.substring(nameEQ.length);
    }
    return null;
  },

  setCookie(key, value, hours) {
    const date = new Date();
    date.setTime(date.getTime() + (hours * 60 * 60 * 1000)); // hours to milliseconds
    document.cookie = `${key}=${value}; expires=${date.toUTCString()}; path=/`;
  },

  generateSessionId() {
    return `session_${Math.random().toString(36).substr(2, 9)}`;
  },
  
  extractNumericId(id) {
    if (!id) return '';
    if (/^\d+$/.test(id)) return String(id);
    const match = id.match(/(\d+)$/);
    return match ? match[1] : String(id);
  }
};