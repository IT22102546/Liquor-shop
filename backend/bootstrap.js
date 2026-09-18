/**
 * Bootstrap polyfill - MUST run before any NestJS code
 * This sets up the global crypto object for @nestjs/schedule
 */

const { webcrypto } = require("crypto");

// Set crypto on all possible global references
if (!globalThis.crypto) {
  globalThis.crypto = webcrypto;
}

if (typeof global !== "undefined" && !global.crypto) {
  global.crypto = webcrypto;
}

// Also set on the global scope directly for direct crypto references
if (typeof crypto === "undefined") {
  global.crypto = webcrypto;
  // Make crypto available as a bare identifier
  Object.defineProperty(global, "crypto", {
    value: webcrypto,
    writable: false,
    configurable: false,
  });
}

console.log("[Bootstrap] Crypto polyfill initialized");
console.log("[Bootstrap] globalThis.crypto:", typeof globalThis.crypto);
console.log("[Bootstrap] global.crypto:", typeof global.crypto);
console.log(
  "[Bootstrap] crypto.randomUUID:",
  typeof globalThis.crypto?.randomUUID
);
