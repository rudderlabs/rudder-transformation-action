function createGitLabPlatform() {
  const inputMap = {
    metaPath: "META_PATH",
    email: "RUDDERSTACK_EMAIL",
    accessToken: "RUDDERSTACK_ACCESS_TOKEN",
    serverEndpoint: "RUDDERSTACK_SERVER_ENDPOINT",
    uploadTestArtifact: "UPLOAD_TEST_ARTIFACT",
    testOnly: "TEST_ONLY",
  };

  return {
    getInput(name) {
      const envName = inputMap[name];
      if (!envName) {
        return "";
      }
      return process.env[envName] || "";
    },
    info(message) {
      // eslint-disable-next-line no-console
      console.log(message);
    },
    async uploadArtifact() {
      // No-op: GitLab CI collects artifacts via artifacts: paths: in .gitlab-ci.yml
    },
    getCommitSha() {
      return process.env.CI_COMMIT_SHA || "";
    },
    setFailed(message) {
      // eslint-disable-next-line no-console
      console.error(message);
      process.exitCode = 1;
    },
  };
}

module.exports = createGitLabPlatform;
