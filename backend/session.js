// fichier: session.js
let currentUser = null;

module.exports = {
  setUser(user) {
    currentUser = user;
  },
  getUser() {
    return currentUser;
  },
  clearUser() {
    currentUser = null;
  }
};
