// Cache de usuarios frecuentes
class UserCache {
  constructor() {
    this.cache = new Map();
    this.maxSize = 50;
    this.ttl = 5 * 60 * 1000; // 5 minutos
  }

  set(email, userData) {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(email, {
      data: userData,
      timestamp: Date.now()
    });
  }

  get(email) {
    const cached = this.cache.get(email);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(email);
      return null;
    }
    
    return cached.data;
  }

  clear() {
    this.cache.clear();
  }
}

export const userCache = new UserCache();