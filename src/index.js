const core = require("@actions/core");
const fs = require("fs");
const isEqual = require("lodash/isEqual");
const artifact = require("@actions/artifact");
const { detailedDiff } = require("deep-object-diff");
var jsonDiff = require("json-diff");
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
  publish
} = require("./apiCalls");

const testOutputDir = "./test-outputs";
const uploadTestArtifact = core.getInput("uploadTestArtifact") || false;
const metaFilePath = core.getInput("metaPath");

const serverList = {
  transformations: [],
  libraries: []
};

const transformationNameToId = {};
const libraryNameToId = {};

const testOnly = (process.env.TEST_ONLY !== 'false');
const commitId = process.env.GITHUB_SHA || '';

function getTransformationsAndLibrariesFromLocal(transformations, libraries) {
  core.info("metaFilePath test: " + metaFilePath);
  let meta = JSON.parse(fs.readFileSync(metaFilePath, "utf-8"));
  if (meta.transformations) {
    transformations.push(...meta.transformations);
  }
  if (meta.libraries) {
    libraries.push(...meta.libraries);
  }
}

function buildNametoIdMap(objectArr, type) {
  if (type == "tr") {
    objectArr.map(tr => {
      transformationNameToId[tr.name] = tr.id;
    });
  } else {
    objectArr.map(lib => {
      libraryNameToId[lib.name] = lib.id;
    });
  }
}

async function init() {
  let res = await getAllTransformations();
  serverList.transformations = res.data
    ? JSON.parse(JSON.stringify(res.data.transformations))
    : [];
  res = await getAllLibraries();
  serverList.libraries = res.data
    ? JSON.parse(JSON.stringify(res.data.libraries))
    : [];

  buildNametoIdMap(serverList.transformations, "tr");
  buildNametoIdMap(serverList.libraries, "lib");
}

async function testAndPublish() {
  const transformationDict = {};
  const libraryDict = {};

  try {
    core.info("Initilaizing...");
    let transformations = [];
    let libraries = [];
    getTransformationsAndLibrariesFromLocal(transformations, libraries);
    await init();

    core.info("list of transformations and libraries successfully fetched");

    for (let i = 0; i < transformations.length; i++) {
      let tr = transformations[i];
      let code = fs.readFileSync(tr.file, "utf-8");
      let res;
      if (transformationNameToId[tr.name]) {
        // update existing transformer and get a new versionId
        let id = transformationNameToId[tr.name];
        res = await updateTransformer(id, tr.description, code);
        core.info(`updated transformation: ${tr.name}`);
      } else {
        // create new transformer
        res = await createTransformer(tr.name, tr.description, code);
        core.info(`created transformation: ${tr.name}`);
      }
      transformationDict[res.data.versionId] = { ...tr, id: res.data.id };
    }
    core.info("transformations create/update done!");

    for (let i = 0; i < libraries.length; i++) {
      let lib = libraries[i];
      let code = fs.readFileSync(lib.file, "utf-8");
      let res;
      if (libraryNameToId[lib.name]) {
        // update library and get a new versionId
        let id = libraryNameToId[lib.name];
        res = await updateLibrary(id, lib.description, code);
        core.info(`updated library: ${lib.name}`);
      } else {
        // create a new library
        res = await createLibrary(lib.name, lib.description, code);
        core.info(`created library: ${lib.name}`);
      }
      libraryDict[res.data.versionId] = { ...lib, id: res.data.id };
    }
    core.info("libraries create/update done!");

    let transformationTest = [];
    let librariesTest = [];

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

    core.info("Running test...");

    let res = await testTransformationAndLibrary(
      transformationTest,
      librariesTest
    );
    core.info(`Test api output: ${JSON.stringify(res.data)}`);

    core.info("Comparing api output with expected output...");
    if (res.data.result.failedTestResults.length > 0) {
      core.info(JSON.stringify(res.data.result.failedTestResults));
      throw new Error(
        "There are failures in running the set against input events"
      );
    }

    let successResults = res.data.result.successTestResults;

    let errorResults = [];
    let testOutputFiles = [];
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir);
    }
    for (let i = 0; i < successResults.length; i++) {
      let transformerVersionID = successResults[i].transformerVersionID;
      if (!transformationDict.hasOwnProperty(transformerVersionID)) {
        continue;
      }

      let apiOutput = successResults[i].result.output.transformedEvents;

      let transformationName =
        _.camelCase(transformationDict[transformerVersionID].name);

      fs.writeFileSync(
        `${testOutputDir}/${transformationName}_output.json`,
        JSON.stringify(apiOutput, null, 2)
      );
      testOutputFiles.push(
        `${testOutputDir}/${transformationName}_output.json`
      );

      if (!transformationDict[transformerVersionID].hasOwnProperty("expected-output")) {
        continue;
      }

      let expectedOutputfile =
        transformationDict[transformerVersionID][
          "expected-output"
        ];
      let expectedOutput = expectedOutputfile
        ? JSON.parse(fs.readFileSync(expectedOutputfile))
        : "";

      if (expectedOutput == "") {
        continue;
      }

      if (!isEqual(expectedOutput, apiOutput)) {
        errorResults.push(
          `Transformer name: ${
            transformationDict[transformerVersionID].name
          } test outputs don't match`
        );

        fs.writeFileSync(
          `${testOutputDir}/${transformationName}_diff.json`,
          JSON.stringify(detailedDiff(expectedOutput, apiOutput), null, 2)
        );

        testOutputFiles.push(
          `${testOutputDir}/${transformationName}_diff.json`
        );
      }
    }

    // upload artifact
    if (uploadTestArtifact === "true") {
      core.info("Uploading test api output...");
      await artifactClient.uploadArtifact(
        "transformer-test-results",
        testOutputFiles,
        "."
      );
    }

    if (errorResults.length > 0) {
      throw new Error(errorResults.join(", "));
    }

    // test passed
    core.info("Test Passed!!!");

    // publish
    if (!testOnly) {
      res = await publish(transformationTest, librariesTest, commitId);
      core.info(`Publish result: ${JSON.stringify(res.data)}`);
    }
    
  } catch (err) {
    if (err.response) {
      core.error(err.response.data);
      core.error(err.response.status);
    }
    core.setFailed(err);
  }
}

testAndPublish();
