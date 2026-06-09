function startUpdateCheckInBackground(checkForUpdates, onError = () => {}) {
  setImmediate(() => {
    Promise.resolve()
      .then(checkForUpdates)
      .catch(onError);
  });
}

module.exports = { startUpdateCheckInBackground };
