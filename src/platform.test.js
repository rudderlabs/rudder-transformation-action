/* eslint-disable global-require */

describe("platform detection and adapters", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("should detect gitlab when GITLAB_CI is set", () => {
    process.env.GITLAB_CI = "true";
    const { detectPlatform } = require("./platform");
    expect(detectPlatform()).toBe("gitlab");
  });

  it("should default to github when no CI env is set", () => {
    delete process.env.GITLAB_CI;
    const { detectPlatform } = require("./platform");
    expect(detectPlatform()).toBe("github");
  });

  it("should read GitLab env vars for getInput", () => {
    process.env.GITLAB_CI = "true";
    process.env.META_PATH = "./my/meta.json";
    process.env.RUDDERSTACK_EMAIL = "test@example.com";
    process.env.RUDDERSTACK_ACCESS_TOKEN = "tok123";
    process.env.RUDDERSTACK_SERVER_ENDPOINT = "https://custom.api.com";
    process.env.UPLOAD_TEST_ARTIFACT = "true";
    process.env.CI_COMMIT_SHA = "abc123def";

    const { init, getPlatform } = require("./platform");
    init("gitlab");
    const p = getPlatform();

    expect(p.getInput("metaPath")).toBe("./my/meta.json");
    expect(p.getInput("email")).toBe("test@example.com");
    expect(p.getInput("accessToken")).toBe("tok123");
    expect(p.getInput("serverEndpoint")).toBe("https://custom.api.com");
    expect(p.getInput("uploadTestArtifact")).toBe("true");
    expect(p.getCommitSha()).toBe("abc123def");
  });

  it("should return empty string for unknown inputs on GitLab", () => {
    const { init, getPlatform } = require("./platform");
    init("gitlab");
    expect(getPlatform().getInput("nonExistent")).toBe("");
  });

  it("should return empty string when GitLab env vars are not set", () => {
    const { init, getPlatform } = require("./platform");
    init("gitlab");
    expect(getPlatform().getInput("metaPath")).toBe("");
    expect(getPlatform().getCommitSha()).toBe("");
  });

  it("should throw if getPlatform called before init", () => {
    const { getPlatform } = require("./platform");
    expect(() => getPlatform()).toThrow("Platform not initialized");
  });

  it("should use console.log for info on GitLab", () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation();
    const { init, getPlatform } = require("./platform");
    init("gitlab");
    getPlatform().info("test message");
    expect(consoleSpy).toHaveBeenCalledWith("test message");
    consoleSpy.mockRestore();
  });

  it("should no-op uploadArtifact on GitLab", async () => {
    const { init, getPlatform } = require("./platform");
    init("gitlab");
    await expect(
      getPlatform().uploadArtifact("name", ["file.json"], "."),
    ).resolves.toBeUndefined();
  });

  describe("GitHub adapter", () => {
    let mockCore;
    let mockArtifactClient;

    beforeEach(() => {
      jest.resetModules();

      mockCore = {
        getInput: jest.fn(),
        info: jest.fn(),
        setFailed: jest.fn(),
      };

      mockArtifactClient = {
        uploadArtifact: jest.fn().mockResolvedValue({ id: "artifact-id-1" }),
      };

      jest.mock("@actions/core", () => mockCore);
      jest.mock("@actions/artifact", () => ({
        DefaultArtifactClient: jest.fn().mockImplementation(() => mockArtifactClient),
      }));
    });

    it("should delegate getInput to core.getInput", () => {
      mockCore.getInput.mockReturnValue("my-value");
      const { init, getPlatform } = require("./platform");
      init("github");
      const result = getPlatform().getInput("someInput");
      expect(mockCore.getInput).toHaveBeenCalledWith("someInput");
      expect(result).toBe("my-value");
    });

    it("should delegate info to core.info", () => {
      const { init, getPlatform } = require("./platform");
      init("github");
      getPlatform().info("hello from github");
      expect(mockCore.info).toHaveBeenCalledWith("hello from github");
    });

    it("should delegate uploadArtifact to the artifact client", async () => {
      const { init, getPlatform } = require("./platform");
      init("github");
      const result = await getPlatform().uploadArtifact(
        "my-artifact",
        ["file1.json"],
        ".",
      );
      expect(mockArtifactClient.uploadArtifact).toHaveBeenCalledWith(
        "my-artifact",
        ["file1.json"],
        ".",
      );
      expect(result).toEqual({ id: "artifact-id-1" });
    });

    it("should read commit SHA from process.env.GITHUB_SHA", () => {
      process.env.GITHUB_SHA = "github-sha-abc123";
      const { init, getPlatform } = require("./platform");
      init("github");
      expect(getPlatform().getCommitSha()).toBe("github-sha-abc123");
    });

    it("should return empty string when GITHUB_SHA is not set", () => {
      delete process.env.GITHUB_SHA;
      const { init, getPlatform } = require("./platform");
      init("github");
      expect(getPlatform().getCommitSha()).toBe("");
    });

    it("should delegate setFailed to core.setFailed", () => {
      const { init, getPlatform } = require("./platform");
      init("github");
      getPlatform().setFailed("something went wrong");
      expect(mockCore.setFailed).toHaveBeenCalledWith("something went wrong");
    });
  });
});
