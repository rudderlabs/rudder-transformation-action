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
  createTransformer,
  createLibrary,
  updateTransformer,
  updateLibrary,
  testTransformationAndLibrary,
  publish,
} = require("./apiCalls");

const testOutputDir = "./test-outputs";
const uploadTestArtifact = core.getInput("uploadTestArtifact") || false;
const metaFilePath = core.getInput("metaPath");

const serverList = {
  transformations: [],
  libraries: [],
};

const transformationNameToId = {};
const libraryNameToId = {};

const testOnly = process.env.TEST_ONLY !== "false";
const commitId = process.env.GITHUB_SHA || "";

// Load transformations and libraries from a local meta file.
function getTransformationsAndLibrariesFromLocal(transformations, libraries) {
  try {
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
  } catch (error) {
    core.error(
      `Error occurred in loading transformations and libraries from meta file: ${metaFilePath}`
    );
    throw error;
  }
}

// Build a map of object names to their respective IDs (e.g., transformation name to ID).
function buildNameToIdMap(objectArr, type) {
  try {
    core.info(`Building name to id map`);
    if (type == "tr") {
      objectArr.map((tr) => {
        transformationNameToId[tr.name] = tr.id;
      });
    } else {
      objectArr.map((lib) => {
        libraryNameToId[lib.name] = lib.id;
      });
    }
  } catch (error) {
    core.error(
      `Error occurred to build name to id map, error: ${error.message}`
    );
  }
}

// Initialize the script.
async function init() {
  try {
    core.info(`Initializing server list`);
    const transformationsResponse = await getAllTransformations();
    serverList.transformations = transformationsResponse.data
      ? JSON.parse(JSON.stringify(transformationsResponse.data.transformations))
      : [];

    const librariesResponse = await getAllLibraries();
    serverList.libraries = librariesResponse.data
      ? JSON.parse(JSON.stringify(librariesResponse.data.libraries))
      : [];

    buildNameToIdMap(serverList.transformations, "tr");
    buildNameToIdMap(serverList.libraries, "lib");

    core.info("Server lists initialized successfully.");
  } catch (error) {
    core.error(`Failed to initialize server lists: ${error.message}`);
    throw error;
  }
}

// Create or update a transformation.
async function createOrUpdateTransformation(
  transformations,
  transformationDict
) {
  try {
    for (let i = 0; i < transformations.length; i++) {
      let tr = transformations[i];
      let code = fs.readFileSync(tr.file, "utf-8");
      let res;
      if (transformationNameToId[tr.name]) {
        // update existing transformer and get a new versionId
        let id = transformationNameToId[tr.name];
        res = await updateTransformer(id, tr.description, code, tr.language);
        core.info(`updated transformation: ${tr.name}`);
      } else {
        // create new transformer
        res = await createTransformer(
          tr.name,
          tr.description,
          code,
          tr.language
        );
        core.info(`created transformation: ${tr.name}`);
      }
      transformationDict[res.data.versionId] = { ...tr, id: res.data.id };
    }
    core.info("Transformations create/update done!");
  } catch (error) {
    core.error(
      `Error occurred in create/update of transformation, error: ${error.message}`
    );
    throw error;
  }
}

// Create or update a library.
async function createOrUpdateLibrary(libraries, libraryDict) {
  try {
    for (let i = 0; i < libraries.length; i++) {
      let lib = libraries[i];
      let code = fs.readFileSync(lib.file, "utf-8");
      let res;
      if (libraryNameToId[lib.name]) {
        // update library and get a new versionId
        let id = libraryNameToId[lib.name];
        res = await updateLibrary(id, lib.description, code, lib.language);
        core.info(`updated library: ${lib.name}`);
      } else {
        // create a new library
        res = await createLibrary(
          lib.name,
          lib.description,
          code,
          lib.language
        );
        core.info(`created library: ${lib.name}`);
      }
      libraryDict[res.data.versionId] = { ...lib, id: res.data.id };
    }
    core.info("Libraries create/update done!");
  } catch (error) {
    core.error(
      `Error occurred in create/update of libraries, error: ${error.message}`
    );
    throw error;
  }
}

// Build the test suite.
async function buildTestSuite(
  transformationDict,
  transformationTest,
  libraryDict,
  librariesTest
) {
  try {
    core.info("Building test suite...");
    for (let i = 0; i < Object.keys(transformationDict).length; i++) {
      let trVersionId = Object.keys(transformationDict)[i];
      let testInputPath =
        transformationDict[trVersionId]["test-input-file"] || "";
      let testInput = testInputPath
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

    for (let i = 0; i < Object.keys(libraryDict).length; i++) {
      librariesTest.push({ versionId: Object.keys(libraryDict)[i] });
    }

    core.info(
      `final transformation versions to be tested:
    ${JSON.stringify(transformationTest)}`
    );
    core.info(
      `final library versions to be tested: ${JSON.stringify(librariesTest)}`
    );
  } catch (error) {
    core.error(
      `Error occurred in building test suites, error: ${error.message}`
    );
    throw error;
  }
}

// Run the test suite.
async function runTestSuite(transformationTest, librariesTest) {
  try {
    core.info("Running test...");

    let res = await testTransformationAndLibrary(
      transformationTest,
      librariesTest
    );
    core.info(`Test api output: ${JSON.stringify(res.data)}`);

    if (res.data.result.failedTestResults.length > 0) {
      core.info(
        `Failed tests: ${JSON.stringify(
          res.data.result.failedTestResults,
          null,
          2
        )}`
      );
      throw new Error(
        "failures occured while running tests against input events"
      );
    }

    return res;
  } catch (error) {
    core.error(`Error occurred in running test suite, error: ${error.message}`);
    throw error;
  }
}

// Compare the API output with the expected output.
async function compareOutput(
  successResults,
  transformationDict,
  testOutputFiles
) {
  try {
    core.info("Comparing api output with expected output...");
    for (let i = 0; i < successResults.length; i++) {
      let transformerVersionID = successResults[i].transformerVersionID;
      if (!transformationDict.hasOwnProperty(transformerVersionID)) {
        continue;
      }

      const apiOutput = successResults[i].result.output.transformedEvents;
      const transformationName = transformationDict[transformerVersionID].name;
      const transformationHandleName = _.camelCase(transformationName);

      fs.writeFileSync(
        `${testOutputDir}/${transformationHandleName}_output.json`,
        JSON.stringify(apiOutput, null, 2)
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

      let expectedOutputfile =
        transformationDict[transformerVersionID]["expected-output"];
      let expectedOutput = expectedOutputfile
        ? JSON.parse(fs.readFileSync(expectedOutputfile))
        : "";

      if (expectedOutput == "") {
        continue;
      }

      if (!isEqual(expectedOutput, apiOutput)) {
        core.info(
          `Test output do not match for transformation: ${transformationName}`
        );
        outputMismatchResults.push(
          `Test output do not match for transformation: ${transformationName}`
        );

        fs.writeFileSync(
          `${testOutputDir}/${transformationHandleName}_diff.json`,
          JSON.stringify(detailedDiff(expectedOutput, apiOutput), null, 2)
        );

        testOutputFiles.push(
          `${testOutputDir}/${transformationHandleName}_diff.json`
        );
      }
    }
  } catch (error) {
    core.error(
      `Error occurred in comparing test output, error: ${error.message}`
    );
    throw error;
  }
}

// Upload the test results to an artifact store.
async function uploadTestArtifacts(testOutputFiles) {
  try {
    // upload artifact
    if (uploadTestArtifact === "true") {
      core.info("Uploading test api output...");
      await artifactClient.uploadArtifact(
        "transformer-test-results",
        testOutputFiles,
        "."
      );
    }
  } catch (error) {
    core.error(
      `Error occurred in uploading test artifacts, error: ${error.message}`
    );
    throw error;
  }
}

// Publish the transformations and libraries.
async function publishTr(transformationTest, librariesTest, commitId) {
  try {
    // publish
    if (!testOnly) {
      res = await publish(transformationTest, librariesTest, commitId);
      core.info(`Publish result: ${JSON.stringify(res.data)}`);
    }
  } catch (error) {
    core.error(
      `Error occurred in publishing transformations, error: ${error.message}`
    );
    throw error;
  }
}
async function testAndPublish() {
  const transformationDict = {};
  const libraryDict = {};
  const outputMismatchResults = [];
  const testOutputFiles = [];

  try {
    core.info("Initializing...");
    const transformations = [];
    let libraries = [];
    getTransformationsAndLibrariesFromLocal(transformations, libraries);
    await init();

    core.info("List of transformations and libraries successfully fetched");

    await createOrUpdateTransformation(transformations, transformationDict);
    await createOrUpdateLibrary(libraries, libraryDict);

    const transformationTest = [];
    const librariesTest = [];

    await buildTestSuite(
      transformationDict,
      transformationTest,
      libraryDict,
      librariesTest
    );

    const successResults = (
      await runTestSuite(transformationTest, librariesTest)
    ).data.result.successTestResults;

    await compareOutput(successResults, transformationDict, testOutputFiles);

    uploadTestArtifacts(testOutputFiles);

    if (outputMismatchResults.length > 0) {
      throw new Error(outputMismatchResults.join(", "));
    }

    core.info("Test Passed!!!");
    publishTr(transformationTest, librariesTest, commitId);
  } catch (err) {
    core.error(err);
    core.setFailed(err.message);
  }
}

// Start the testing and publishing process.
testAndPublish();
