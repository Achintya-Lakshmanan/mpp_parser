/**
 * Return a promise that resolves after `ms` milliseconds.
 * @param {number} ms Milliseconds to wait
 * @returns {Promise<void>}
 */
function delay(ms = 0) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = delay;
