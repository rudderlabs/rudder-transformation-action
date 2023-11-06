const core = require("@actions/core");
const fs = require("fs");
const artifact = require("@actions/artifact");
const _ = require("lodash");
const { detailedDiff } = require("deep-object-diff");
const apiCalls = require("./apiCalls");

const testOutputDir = "./test-outputs";
const uploadTestArtifact = core.getInput("uploadTestArtifact") || false;
const metaFilePath = core.getInput("metaPath");

const testOnly = process.env.TEST_ONLY !== "false";
const commitId = process.env.GITHUB_SHA || "";

async function readMetaFile() {
  core.info(`Reading meta file from: ${metaFilePath}`);
  return JSON.parse(fs.readFileSync(metaFilePath, "utf-8"));
}

async function initializeServerLists() {
  core.info("Initializing server lists...");
  try {
    const serverLists = await apiCalls.initializeServerLists();
    core.info("Server lists initialized successfully.");
    return serverLists;
  } catch (error) {
    core.error(`Failed to initialize server lists: ${error.message}`);
    throw error;
  }
}

async function processTransformationsAndLibraries(transformations, libraries) {
  const transformationDict = {};
  const libraryDict = {};

  for (const tr of transformations) {
    const code = fs.readFileSync(tr.file, "utf-8");
    let res;
    if (transformationNameToId[tr.name]) {
      const id = transformationNameToId[tr.name];
      res = await apiCalls.updateTransformer(id, tr.description, code, tr.language);
      core.info(`Updated transformation: ${tr.name}`);
    } else {
      res = await apiCalls.createTransformer(tr.name, tr.description, code, tr.language);
      core.info(`Created transformation: ${tr.name}`);
    }
    transformationDict[res.data.versionId] = { ...tr, id: res.data.id };
  }

  for (const lib of libraries) {
    const code = fs.readFileSync(lib.file, "utf-8");
    let res;
    if (libraryNameToId[lib.name]) {
      const id = libraryNameToId[lib.name];
      res = await apiCalls.updateLibrary(id, lib.description, code, lib.language);
      core.info(`Updated library: ${lib.name}`);
    } else {
      res = await apiCalls.createLibrary(lib.name, lib.description, code, lib.language);
      core.info(`Created library: ${lib.name}`);
    }
    libraryDict[res.data.versionId] = { ...lib, id: res.data.id };
  }

  return { transformationDict, libraryDict };
}

async function buildTestSuite(transformationDict, libraryDict) {
  const transformationTest = [];
  const librariesTest = [];

  for (const trVersionId of Object.keys(transformationDict)) {
    const testInputPath = transformationDict[trVersionId]["test-input-file"] || "";
    const testInput = testInputPath ? JSON.parse(fs.readFileSync(testInputPath)) : null;
    transformationTest.push({ versionId: trVersionId, testInput });
  }

  for (const libVersionId of Object.keys(libraryDict)) {
    librariesTest.push({ versionId: libVersionId });
  }

  return { transformationTest, librariesTest };
}

async function runTests(transformationTest, librariesTest) {
  core.info("Running tests...");
  const res = await apiCalls.testTransformationAndLibrary(transformationTest, librariesTest);
  core.info(`Test API output: ${JSON.stringify(res.data)}`);
  return res;
}

function createTestOutputFiles(successResults, transformationDict) {
  const outputMismatchResults = [];
  const testOutputFiles = [];

  if (!fs.existsSync(testOutputDir)) {
    fs.mkdirSync(testOutputDir);
  }

  core.info("Comparing API output with expected output...");

  for (const successResult of successResults) {
    const transformerVersionID = successResult.transformerVersionID;
    if (transformationDict.hasOwnProperty(transformerVersionID)) {
      const apiOutput = successResult.result.output.transformedEvents;
      const transformationName = transformationDict[transformerVersionID].name;
      const transformationHandleName = _.camelCase(transformationName);

      const expectedOutputfile = transformationDict[transformerVersionID]["expected-output"];
      const expectedOutput = expectedOutputfile ? JSON.parse(fs.readFileSync(expectedOutputfile)) : null;

      if (expectedOutput && !_.isEqual(expectedOutput, apiOutput)) {
        core.info(`Test output does not match for transformation: ${transformationName}`);
        outputMismatchResults.push(`Test output does not match for transformation: ${transformationName}`);

        fs.writeFileSync(`${testOutputDir}/${transformationHandleName}_diff.json`, JSON.stringify(detailedDiff(expectedOutput, apiOutput), null, 2));
        testOutputFiles.push(`${testOutputDir}/${transformationHandleName}_diff.json`);
      }

      fs.writeFileSync(`${testOutputDir}/${transformationHandleName}_output.json`, JSON.stringify(apiOutput, null, 2));
      testOutputFiles.push(`${testOutputDir}/${transformationHandleName}_output.json`);
    }
  }

  return { outputMismatchResults, testOutputFiles };
}

async function uploadTestResults(testOutputFiles) {
  if (uploadTestArtifact === "true") {
    core.info("Uploading test API output...");
    await apiCalls.uploadTestResults(testOutputFiles);
  }
}

async function publishResults(testOnly, transformationTest, librariesTest, commitId) {
  if (!testOnly) {
    const res = await apiCalls.publishResults(transformationTest, librariesTest, commitId);
    core.info(`Publish result: ${JSON.stringify(res.data)}`);
  }
}

async function testAndPublish() {
  try {
    core.info("Initializing...");

    const metaContent = await readMetaFile();
    const serverLists = await initializeServerLists();
    const { transformations, libraries } = metaContent;

    const { transformationDict, libraryDict } = await processTransformationsAndLibraries(transformations, libraries);

    core.info("Transformations and libraries create/update done!");

    const { transformationTest, librariesTest } = await buildTestSuite(transformationDict, libraryDict);

    core.info(`Final transformation versions to be tested: ${JSON.stringify(transformationTest)}`);
    core.info(`Final library versions to be tested: ${JSON.stringify(librariesTest)}`);

    const testResults = await runTests(transformationTest, librariesTest);

    if (testResults.data.result.failedTestResults.length > 0) {
      core.info(`Failed tests: ${JSON.stringify(testResults.data.result.failedTestResults, null, 2)}`);
      throw new Error("Failures occurred while running tests against input events");
    }

    const { outputMismatchResults, testOutputFiles } = createTestOutputFiles(testResults.data.result.successTestResults, transformationDict);

    await uploadTestResults(testOutputFiles);

    if (outputMismatchResults.length > 0) {
      throw new Error(outputMismatchResults.join(", "));
    }

    // Test passed
    core.info("Test Passed!!!");

    // Publish results
    publishResults(testOnly, transformationTest, librariesTest, commitId);
  } catch (err) {
    if (err.response) {
      core.error(`API response data: ${JSON.stringify(err.response.data)}`);
      core.error(`API response status: ${err.response.status}`);
    }
    core.setFailed(err);
  }
}

testAndPublish();
