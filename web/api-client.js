/* Shared request boundary: endpoint URLs and authorization remain caller-owned. */
(() => {
  'use strict';
  window.AppHttp = {
    async fetch(url, options = {
    }) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      try {
        return await fetch(url, {
          ...options, signal: options.signal || controller.signal
        });
      } catch (error) {
        if (error.name === 'AbortError') throw Error('The request timed out. Please retry.');
        throw error;
      } finally {
        clearTimeout(timer);
      }
    }
  };
})();
