// Platform abstraction layer.
// Provides a unified interface for GitHub Actions and GitLab CI.
// IMPORTANT: init() must be called before requiring any module that uses getPlatform().

const createGitHubPlatform = require("./platforms/github");
const createGitLabPlatform = require("./platforms/gitlab");

const platforms = {
  github: createGitHubPlatform,
  gitlab: createGitLabPlatform,
};

let platform = null;

function detectPlatform() {
  if (process.env.GITLAB_CI === "true") {
    return "gitlab";
  }
  return "github";
}

function init(forcePlatform) {
  // If already initialized and not forcing a specific platform (e.g. in tests),
  // return the existing instance to avoid re-initialization.
  if (platform && !forcePlatform) {
    return platform;
  }
  const name = forcePlatform || detectPlatform();
  const factory = platforms[name];
  if (!factory) {
    throw new Error(`Unknown platform: ${name}`);
  }
  platform = factory();
  return platform;
}

function getPlatform() {
  if (!platform) {
    throw new Error(
      "Platform not initialized. Call platform.init() before requiring other modules.",
    );
  }
  return platform;
}

module.exports = { init, getPlatform, detectPlatform };
