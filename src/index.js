const core = require("@actions/core");
const fs = require("fs");
const isEqual = require("lodash/isEqual");
const artifact = require("@actions/artifact");
const artifactClient = artifact.create();
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

const uploadTestArtifact = core.getInput("uploadTestArtifact") || false;
const metaFilePath = core.getInput("metaPath");

const { transformations, libraries } = JSON.parse(
  fs.readFileSync(metaFilePath, "utf-8")
);
console.log("---transformations---", transformations);
console.log("----libraries---", libraries);

const serverList = {
  transformations: [],
  libraries: []
};

const transformationNameToId = {};
const libraryNameToId = {};

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
    await init();

    for (let i = 0; i < transformations.length; i++) {
      let tr = transformations[i];
      let code = fs.readFileSync(tr.file, "utf-8");
      let res;
      if (transformationNameToId[tr.name]) {
        // update existing transformer and get a new versionId
        let id = transformationNameToId[tr.name];
        res = await updateTransformer(id, tr.description, code);
      } else {
        // create new transformer
        res = await createTransformer(tr.name, tr.description, code);
      }
      transformationDict[res.data.versionId] = { ...tr, id: res.data.id };
      console.log("creating transformation");
    }

    console.log("transformation done!");

    for (let i = 0; i < libraries.length; i++) {
      let lib = libraries[i];
      let code = fs.readFileSync(lib.file, "utf-8");
      let res;
      if (libraryNameToId[lib.name]) {
        // update library and get a new versionId
        let id = libraryNameToId[lib.name];
        res = await updateLibrary(id, lib.description, code);
      } else {
        // create a new library
        res = await createLibrary(lib.name, lib.description, code);
      }
      libraryDict[res.data.versionId] = { ...lib, id: res.data.id };
      console.log("creating library");
    }

    console.log("library done!");

    let transformationTest = [];
    let librariesTest = [];

    for (let i = 0; i < Object.keys(transformationDict).length; i++) {
      let trVersionId = Object.keys(transformationDict)[i];
      let testInputPath = transformationDict[trVersionId]["test-input-file"];
      let testInput = JSON.parse(fs.readFileSync(testInputPath));
      transformationTest.push({ versionId: trVersionId, testInput });
    }

    for (let i = 0; i < Object.keys(libraryDict).length; i++) {
      librariesTest.push({ versionId: Object.keys(libraryDict)[i] });
    }

    console.log("final transformation------", transformationTest);
    console.log("final library-----", librariesTest);

    let res = await testTransformationAndLibrary(
      transformationTest,
      librariesTest
    );
    console.log(JSON.stringify(res.data));

    // upload artifact
    if (uploadTestArtifact) {
      fs.writeFileSync("test-results.json", JSON.stringify(res.data));
      await artifactClient.uploadArtifact(
        "transformer-test-results",
        ["test-results.json"],
        "."
      );
    }

    if (res.data.result.failedTestResults.length > 0) {
      throw new Error(
        "There are failures in running the set aggainst input events"
      );
    }

    let successResults = res.data.result.successTestResults;

    for (let i = 0; i < successResults.length; i++) {
      let expectedOutputfile =
        transformationDict[successResults[i].transformerVersionID][
          "expected-output"
        ];
      let expectedOutput = expectedOutputfile
        ? JSON.parse(fs.readFileSync(expectedOutputfile))
        : "";
      if (expectedOutput == "") {
        continue;
      }
      let apiOutput = successResults[i].result.output;
      if (!isEqual(expectedOutput, apiOutput)) {
        throw new Error(
          `${successResults[i].transformerVersionID} outputs don't match`
        );
      }
    }

    // test passed
    console.log("Test Passed!!!");

    // publish

    res = await publish(transformationTest, librariesTest);
    console.log(res.data);
  } catch (err) {
    if (err.response) {
      console.log(err.response.data);
      console.log(err.response.status);
      core.setFailed(err);
    }
  }
}

testAndPublish();
