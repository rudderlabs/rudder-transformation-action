const core = require("@actions/core");
const fs = require("fs");
const isEqual = require("lodash/isEqual");
const artifact = require("@actions/artifact");
const { detailedDiff } = require("deep-object-diff");
const artifactClient = artifact.create();
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
const uploadTestArtifact =
  Boolean(core.getInput("uploadTestArtifact")) || false;
const metaFilePath = core.getInput("metaPath");

const testOnly = process.env.TEST_ONLY !== "false";
const commitId = process.env.GITHUB_SHA || "";

// Load transformations and libraries from a local meta file.
function getTransformationsAndLibrariesFromLocal() {
  const transformations = [],
    libraries = [];

  core.info(
    `Loading transformations and libraries from the meta file: ${metaFilePath}`
  );

  let meta = JSON.parse(fs.readFileSync(metaFilePath, "utf-8"));
  if (meta.transformations) {
    transformations.push(...meta.transformations);
  }
  if (meta.libraries) {
    libraries.push(...meta.libraries);
  }
  return { transformations, libraries };
}

// Build a map of object names to their respective IDs (e.g., transformation name to ID).
function buildNameToIdMap(objectArr, type) {
  const transformationNameToId = {};
  const libraryNameToId = {};

  core.info(`Building name to id map`);
  if (type == "tr") {
    objectArr.map((tr) => {
      transformationNameToId[tr.name] = tr.id;
    });
    return transformationNameToId;
  } else {
    objectArr.map((lib) => {
      libraryNameToId[lib.name] = lib.id;
    });
    return libraryNameToId;
  }
}

// Fetch transformation and libraries.
async function loadTransformationsAndLibraries() {
  let all_transformations = [];
  let all_libraries = [];

  const transformationsResponse = await getAllTransformations();
  all_transformations = transformationsResponse.data
    ? JSON.parse(JSON.stringify(transformationsResponse.data.transformations))
    : [];

  const librariesResponse = await getAllLibraries();
  all_libraries = librariesResponse.data
    ? JSON.parse(JSON.stringify(librariesResponse.data.libraries))
    : [];

  return { all_transformations, all_libraries };
}

// Create or update transformations
async function upsertTransformations(transformations, transformationNameToId) {
  const transformationDict = {};
  core.info(`Upserting transformations`);

  for (const tr of transformations) {
    const code = fs.readFileSync(tr.file, "utf-8");
    let res;
    if (transformationNameToId[tr.name]) {
      // update existing transformer and get a new versionId
      const id = transformationNameToId[tr.name];
      res = await updateTransformation(
        id,
        tr.name,
        tr.description,
        code,
        tr.language
      );
    } else {
      // create new transformer
      res = await createTransformation(
        tr.name,
        tr.description,
        code,
        tr.language
      );
    }
    transformationDict[res.data.versionId] = { ...tr, id: res.data.id };
  }

  return transformationDict;
}

// Create or update a library.
async function upsertLibraries(libraries, libraryNameToId) {
  const libraryDict = {};
  core.info(`Upserting libraries`);
  for (const lib of libraries) {
    const code = fs.readFileSync(lib.file, "utf-8");
    let res;
    if (libraryNameToId[lib.name]) {
      // update library and get a new versionId
      const id = libraryNameToId[lib.name];
      res = await updateLibrary(id, lib.description, code, lib.language);
      core.info(`Updated library: ${lib.name}`);
    } else {
      // create a new library
      res = await createLibrary(lib.name, lib.description, code, lib.language);
      core.info(`Created library: ${lib.name}`);
    }
    libraryDict[res.data.versionId] = { ...lib, id: res.data.id };
  }
  return libraryDict;
}

// Build the test suite.
async function buildTestSuite(transformationDict, libraryDict) {
  const transformationTest = [],
    librariesTest = [];
  core.info("Building test suite");

  for (const trVersionId of Object.keys(transformationDict)) {
    const testInputPath =
      transformationDict[trVersionId]["test-input-file"] || "";
    const testInput = testInputPath
      ? JSON.parse(fs.readFileSync(testInputPath))
      : "";
    if (testInput) {
      transformationTest.push({ versionId: trVersionId, testInput });
    } else {
      core.info(
        `No test input provided. Testing ${transformationDict[trVersionId].name} with default payload`
      );
      transformationTest.push({ versionId: trVersionId });
    }
  }

  for (const versionId of Object.keys(libraryDict)) {
    librariesTest.push({ versionId });
  }

  core.info(
    `Final transformation versions to be tested:
    ${JSON.stringify(transformationTest)}`
  );
  core.info(
    `Final library versions to be tested: ${JSON.stringify(librariesTest)}`
  );
  return { transformationTest, librariesTest };
}

// Run the test suite.
async function runTestSuite(transformationTest, librariesTest) {
  core.info("Running test suite for transformations and libraries");

  let res = await testTransformationAndLibrary(
    transformationTest,
    librariesTest
  );

  core.info(
    colorize(
      `\nTotal tests ${
        res.data.result.successTestResults.length +
        res.data.result.failedTestResults.length
      }, ${res.data.result.successTestResults.length} passed and ${
        res.data.result.failedTestResults.length
      } failed\n`,
      "yellow"
    )
  );
  if (res.data.result.failedTestResults.length > 0) {
    logFailedTests(res.data.result.failedTestResults);
    throw new Error(
      "Failures occured while running tests against input events"
    );
  }

  return res;
}

// Compare the API output with the expected output.
async function compareOutput(
  successResults,
  transformationDict,
  testOutputFiles
) {
  core.info("Comparing api output with expected output");

  for (const successResult of successResults) {
    const transformerVersionID = successResult.transformerVersionID;

    if (!transformationDict.hasOwnProperty(transformerVersionID)) {
      continue;
    }

    const actualOutput = successResult.result.output.transformedEvents;
    const transformationName = transformationDict[transformerVersionID].name;
    const transformationHandleName = _.camelCase(transformationName);

    fs.writeFileSync(
      `${testOutputDir}/${transformationHandleName}_output.json`,
      JSON.stringify(actualOutput, null, 2)
    );
    testOutputFiles.push(
      `${testOutputDir}/${transformationHandleName}_output.json`
    );

    if (
      !transformationDict[transformerVersionID].hasOwnProperty(
        "expected-output"
      )
    ) {
      continue;
    }

    const expectedOutputfile =
      transformationDict[transformerVersionID]["expected-output"];
    const expectedOutput = expectedOutputfile
      ? JSON.parse(fs.readFileSync(expectedOutputfile))
      : "";

    if (expectedOutput == "") {
      continue;
    }

    if (!isEqual(expectedOutput, actualOutput)) {
      core.info(
        `Test output do not match for transformation: ${transformationName}`
      );
      outputMismatchResults.push(
        `Test output do not match for transformation: ${transformationName}`
      );

      fs.writeFileSync(
        `${testOutputDir}/${transformationHandleName}_diff.json`,
        JSON.stringify(detailedDiff(expectedOutput, actualOutput), null, 2)
      );

      testOutputFiles.push(
        `${testOutputDir}/${transformationHandleName}_diff.json`
      );
    }
  }
}

// Upload the test results to an artifact store.
async function uploadTestArtifacts(testOutputFiles) {
  core.info(`Uploading test artifacts`);
  // upload artifact
  if (uploadTestArtifact) {
    core.info("Uploading test api output");
    const artifactClientResponse = await artifactClient.uploadArtifact(
      "transformer-test-results",
      testOutputFiles,
      "."
    );

    if (artifactClientResponse.failedItems.length > 0) {
      throw new Error(
        `Artifacts upload failed, failedItem: ${JSON.stringify(failedItems)}`
      );
    }
  }
}

// Publish the transformations and libraries.
async function publishTransformation(
  transformationTest,
  librariesTest,
  commitId
) {
  core.info(`Publishing transformations and libraries`);
  // publish
  res = await publish(transformationTest, librariesTest, commitId);
  core.info(`Publish result: ${JSON.stringify(res.data)}`);
}

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
function logFailedTests(tests) {
  core.info(colorize("\nFailed Tests:\n", "yellow"));
  for (const test of tests) {
    core.info(colorize(`   ID: ${test.id}`, "red"));
    core.info(colorize(`   Name: ${test.name}`, "red"));
    core.info(colorize(`   Error: ${JSON.stringify(test.result)}\n`, "red"));
    core.info("\n" + "=".repeat(40) + "\n"); // Add a line of equal signs between logs
  }
}

async function testAndPublish() {
  const outputMismatchResults = [];
  const testOutputFiles = [];

  core.info("Initializing...");
  // const transformations = [], libraries = [];
  const { transformations, libraries } =
    getTransformationsAndLibrariesFromLocal();
  const { all_transformations, all_libraries } =
    await loadTransformationsAndLibraries();

  const transformationNameToId = buildNameToIdMap(all_transformations, "tr");
  const libraryNameToId = buildNameToIdMap(all_libraries, "lib");

  core.info("List of transformations and libraries successfully fetched");

  const transformationDict = await upsertTransformations(
    transformations,
    transformationNameToId
  );

  const libraryDict = await upsertLibraries(libraries, libraryNameToId);

  const { transformationTest, librariesTest } = await buildTestSuite(
    transformationDict,
    libraryDict
  );

  const testSuiteResult = (
    await runTestSuite(transformationTest, librariesTest)
  ).data.result;

  await compareOutput(
    testSuiteResult.successTestResults,
    transformationDict,
    testOutputFiles
  );

  await uploadTestArtifacts(testOutputFiles);

  if (outputMismatchResults.length > 0) {
    throw new Error(outputMismatchResults.join(", "));
  }

  core.info("Test Passed!!!");
  if (!testOnly) {
    await publishTransformation(transformationTest, librariesTest, commitId);
  }
}

// Start the testing and publishing process.
testAndPublish();
