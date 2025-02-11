const core = require("@actions/core");
const fs = require("fs");
const isEqual = require("lodash/isEqual");
const { DefaultArtifactClient } = require("@actions/artifact");
const { detailedDiff } = require("deep-object-diff");
const _ = require("lodash");
const {
  getAllTransformations,
  getAllLibraries,
  createTransformation,
  createLibrary,
  updateTransformation,
  updateLibrary,
  testTransformationAndLibrary,
  publish,
} = require("./apiCalls");

const testOutputDir = "./test-outputs";
const uploadTestArtifact = core.getInput("uploadTestArtifact")?.toLowerCase() === "true";
const metaFilePath = core.getInput("metaPath");

const testOnly = process.env.TEST_ONLY !== "false";
const commitId = process.env.GITHUB_SHA || "";
const artifactClient = new DefaultArtifactClient();

function colorize(message, color) {
  const colors = {
    reset: "\x1b[0m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m",
  };

  return `${colors[color]}${message}${colors.reset}`;
}

// Log failed tests
function logResult(result) {
  core.info(
    colorize(
      `\nTotal tests ${
        result.successTestResults.length + result.failedTestResults.length
      }, ${result.successTestResults.length} passed and ${
        result.failedTestResults.length
      } failed\n`,
      "yellow",
    ),
  );
  if (result.failedTestResults.length > 0) {
    core.info(colorize("\nFailed Tests:\n", "yellow"));

    for (const test of result.failedTestResults) {
      core.info(colorize(`   ID: ${test.id}`, "red"));
      core.info(colorize(`   Name: ${test.name}`, "red"));
      core.info(colorize(`   Error: ${JSON.stringify(test.result)}\n`, "red"));
      core.info(`\n${"=".repeat(40)}\n`);
    }
  }
}

// Load transformations and libraries from a local meta file.
function getTransformationsAndLibrariesFromLocal(fpath) {
  core.info(`Loading transformations and libraries locally from: ${fpath}`);

  const transformations = [];
  const libraries = [];

  const meta = JSON.parse(fs.readFileSync(fpath, "utf-8"));
  if (meta.transformations) {
    transformations.push(...meta.transformations);
  }
  if (meta.libraries) {
    libraries.push(...meta.libraries);
  }
  return { transformations, libraries };
}

function buildNameToIdMap(arr) {
  return arr.reduce((acc, entry) => {
    acc[entry.name] = entry.id;
    return acc;
  }, {});
}

// Fetch transformation and libraries.
async function loadTransformationsAndLibraries() {
  let workspaceTransformations = [];
  let workspaceLibraries = [];

  const transformationsResponse = await getAllTransformations();
  workspaceTransformations = transformationsResponse.data
    ? JSON.parse(JSON.stringify(transformationsResponse.data.transformations))
    : [];

  const librariesResponse = await getAllLibraries();
  workspaceLibraries = librariesResponse.data
    ? JSON.parse(JSON.stringify(librariesResponse.data.libraries))
    : [];

  return { workspaceTransformations, workspaceLibraries };
}

// Create or update transformations
async function upsertTransformations(transformations, transformationNameToId) {
  core.info("Upserting transformations");

  const transformationDict = {};

  for (const tr of transformations) {
    const code = fs.readFileSync(tr.file, "utf-8");
    let res;
    if (transformationNameToId[tr.name]) {
      // update existing transformer and get a new versionId
      const id = transformationNameToId[tr.name];
      res = await updateTransformation(id, tr.name, tr.description, code, tr.language);
    } else {
      // create new transformer
      res = await createTransformation(tr.name, tr.description, code, tr.language);
    }
    transformationDict[res.data.versionId] = { ...tr, id: res.data.id };
  }

  return transformationDict;
}

// Create or update a library.
async function upsertLibraries(libraries, libraryNameToId) {
  core.info("Upserting libraries upstream");

  const libraryDict = {};
  for (const lib of libraries) {
    const code = fs.readFileSync(lib.file, "utf-8");
    let res;
    if (libraryNameToId[lib.name]) {
      // update library and get a new versionId
      core.info(`Updating library: ${lib.name}`);
      const id = libraryNameToId[lib.name];
      res = await updateLibrary(id, lib.description, code, lib.language);
    } else {
      // create a new library
      core.info(`Creating library: ${lib.name}`);
      res = await createLibrary(lib.name, lib.description, code, lib.language);
    }
    libraryDict[res.data.versionId] = { ...lib, id: res.data.id };
  }
  return libraryDict;
}

// Build the test suite.
async function buildTestSuite(transformationDict, libraryDict) {
  core.info("Building test suite");

  const transformationTest = [];
  const librariesTest = [];

  for (const trVersionId of Object.keys(transformationDict)) {
    const testInputPath = transformationDict[trVersionId]["test-input-file"] || "";
    const testInput = testInputPath ? JSON.parse(fs.readFileSync(testInputPath)) : "";
    if (testInput) {
      transformationTest.push({ versionId: trVersionId, testInput });
    } else {
      core.info(
        `No test input provided. Testing ${transformationDict[trVersionId].name} with default payload`,
      );
      transformationTest.push({ versionId: trVersionId });
    }
  }

  for (const versionId of Object.keys(libraryDict)) {
    librariesTest.push({ versionId });
  }

  core.info(
    `Final transformation versions to be tested:
    ${JSON.stringify(transformationTest)}`,
  );
  core.info(`Final library versions to be tested: ${JSON.stringify(librariesTest)}`);
  return { transformationTest, librariesTest };
}

// Run the test suite.
async function runTestSuite(transformationTest, librariesTest) {
  core.info("Running test suite for transformations and libraries");

  const res = await testTransformationAndLibrary(transformationTest, librariesTest);

  logResult(res.data.result);

  if (res.data.result.failedTestResults.length > 0) {
    throw new Error("Failures occured while running tests against input events");
  }

  return res;
}

// Compare the API output with the actual output.
async function compareOutput(successResults, transformationDict) {
  core.info("Comparing actual output with expected output");

  const outputMismatchResults = [];
  const testOutputFiles = [];
  for (const successResult of successResults) {
    const { transformerVersionID } = successResult;

    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir);
    }

    if (!Object.prototype.hasOwnProperty.call(transformationDict, transformerVersionID)) {
      continue;
    }

    const actualOutput = successResult.result.output.transformedEvents;
    const transformationName = transformationDict[transformerVersionID].name;
    const transformationHandleName = _.camelCase(transformationName);

    fs.writeFileSync(
      `${testOutputDir}/${transformationHandleName}_output.json`,
      JSON.stringify(actualOutput, null, 2),
    );
    testOutputFiles.push(`${testOutputDir}/${transformationHandleName}_output.json`);

    if (
      !Object.prototype.hasOwnProperty.call(
        transformationDict[transformerVersionID],
        "expected-output",
      )
    ) {
      continue;
    }

    const expectedOutputfile = transformationDict[transformerVersionID]["expected-output"];
    const expectedOutput = expectedOutputfile ? JSON.parse(fs.readFileSync(expectedOutputfile)) : "";

    if (expectedOutput === "") {
      continue;
    }

    if (!isEqual(expectedOutput, actualOutput)) {
      core.info(`Test output do not match for transformation: ${transformationName}`);
      outputMismatchResults.push(
        `Test output do not match for transformation: ${transformationName}`,
      );

      fs.writeFileSync(
        `${testOutputDir}/${transformationHandleName}_diff.json`,
        JSON.stringify(detailedDiff(expectedOutput, actualOutput), null, 2),
      );

      testOutputFiles.push(`${testOutputDir}/${transformationHandleName}_diff.json`);
    }
  }
  return { outputMismatchResults, testOutputFiles };
}

// Upload the test results to an artifact store.
async function uploadTestArtifacts(testOutputFiles) {
  core.info("Uploading test artifacts");
  // upload artifact

  const artifactClientResponse = await artifactClient.uploadArtifact(
    "transformer-test-results",
    testOutputFiles,
    ".",
  );

  core.info(`Test artifact uploaded with id: ${artifactClientResponse.id}`);
}

// Publish the transformations and libraries.
async function publishTransformation(transformationTest, librariesTest, commitIdentifier) {
  core.info("Publishing transformations and libraries");
  // publish
  await publish(transformationTest, librariesTest, commitIdentifier);
}

async function testAndPublish(path = metaFilePath) {
  core.info("Starting with test and publish of the transformations and libraries");

  const { transformations, libraries } = getTransformationsAndLibrariesFromLocal(path);
  const { workspaceTransformations, workspaceLibraries } = await loadTransformationsAndLibraries();

  const transformationNameToId = buildNameToIdMap(workspaceTransformations);
  const libraryNameToId = buildNameToIdMap(workspaceLibraries);

  const transformationDict = await upsertTransformations(transformations, transformationNameToId);

  const libraryDict = await upsertLibraries(libraries, libraryNameToId);

  const { transformationTest, librariesTest } = await buildTestSuite(
    transformationDict,
    libraryDict,
  );

  const testSuiteResult = (await runTestSuite(transformationTest, librariesTest)).data.result;

  const { outputMismatchResults, testOutputFiles } = await compareOutput(
    testSuiteResult.successTestResults,
    transformationDict,
  );

  if (uploadTestArtifact) {
    await uploadTestArtifacts(testOutputFiles);
  }

  if (outputMismatchResults.length > 0) {
    throw new Error(outputMismatchResults.join(", "));
  }

  if (!testOnly) {
    await publishTransformation(transformationTest, librariesTest, commitId);
  }

  core.info("Successfully executed the workflow");
}

module.exports = {
  getTransformationsAndLibrariesFromLocal,
  buildNameToIdMap,
  loadTransformationsAndLibraries,
  upsertTransformations,
  upsertLibraries,
  buildTestSuite,
  testAndPublish,
  colorize,
};
