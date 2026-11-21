/* Voice dictation for existing delivery search fields; never begins automatically. */
(() => {
  'use strict';
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) return;
  const setups = [
    ['partnerSearch', 'partnerVoiceSearch'],
    ['deliverySearch', 'deliveryVoiceSearch'],
  ];
  const locale = () => document.documentElement.lang?.toLowerCase().startsWith('hi') ||
    navigator.language?.toLowerCase().startsWith('hi') ? 'hi-IN' : 'en-IN';
  function initialize() {
    for (const [fieldId, buttonId] of setups) {
      const input = document.getElementById(fieldId);
      const button = document.getElementById(buttonId);
      if (!input || !button) continue;
      button.hidden = false;
      let engine = null;
      let listening = false;
      const caption = button.getAttribute('aria-label') || 'Search by voice';
      const update = () => {
        const text = listening ? 'Stop listening' : caption;
        button.setAttribute('aria-pressed', String(listening));
        button.setAttribute('aria-label', text);
        button.title = text;
      };
      button.addEventListener('click', () => {
        if (listening) { engine?.stop(); return; }
        engine = new Recognition();
        engine.lang = locale();
        engine.continuous = false;
        engine.interimResults = false;
        engine.maxAlternatives = 1;
        engine.onresult = (event) => {
          const phrase = event.results?.[0]?.[0]?.transcript?.trim();
          if (!phrase) return;
          input.value = phrase;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.focus({ preventScroll: true });
        };
        engine.onend = () => { listening = false; update(); };
        engine.onerror = () => { listening = false; update(); };
        try { engine.start(); listening = true; update(); }
        catch (_) { listening = false; update(); }
      });
      update();
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
