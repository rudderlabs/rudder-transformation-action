/* eslint-disable global-require */

function createGitHubPlatform() {
  const core = require("@actions/core");
  const { DefaultArtifactClient } = require("@actions/artifact");
  const artifactClient = new DefaultArtifactClient();

  return {
    getInput(name) {
      return core.getInput(name);
    },
    info(message) {
      core.info(message);
    },
    async uploadArtifact(name, files, rootDir) {
      return artifactClient.uploadArtifact(name, files, rootDir);
    },
    getCommitSha() {
      return process.env.GITHUB_SHA || "";
    },
    setFailed(message) {
      core.setFailed(message);
    },
  };
}

module.exports = createGitHubPlatform;
