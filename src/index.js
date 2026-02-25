const { init, getPlatform } = require("./platform");

// Initialize platform before requiring modules that call getInput() at load time.
init();

const { testAndPublish } = require("./main");

// Start the testing and publishing process.
testAndPublish().catch((error) => {
  const p = getPlatform();
  p.setFailed(error.message);
  process.exitCode = 1;
});
