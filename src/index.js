const core = require("@actions/core");
const fs = require("fs");
const {
  createTransformer,
  createLibrary,
  testTransformationAndLibrary
} = require("./apiCalls");

const metaFilePath = core.getInput("metaPath");

const { transformations, libraries } = JSON.parse(
  fs.readFileSync(metaFilePath, "utf-8")
);

async function test() {
  const transformationDict = {};
  const libraryDict = {};

  try {
    transformations.forEach(async tr => {
      let code = fs.readFileSync(tr.file, "utf-8");
      let res = await createTransformer(tr.name, tr.description, code);
      transformationDict[res.data.versionId] = { ...tr, id: res.data.id };
    });

    libraries.forEach(async lib => {
      let code = fs.readFileSync(lib.file, "utf-8");
      let res = await createLibrary(lib.name, lib.description, code);
      libraryDict[res.data.versionId] = { ...lib, id: res.data.id };
    });

    let transformationTest = [];
    let librariesTest = [];

    Object.keys(transformationDict).forEach(trVersionId => {
      let testInputPath = transformationDict[trVersionId]["test-input-file"];
      let testInput = JSON.parse(fs.readFileSync(testInputPath));
      transformationTest.push({ versionId: trVersionId, testInput });
    });

    Object.keys(libraryDict).forEach(libVersionId => {
      librariesTest.push({ versionId: libVersionId });
    });

    let res = await testTransformationAndLibrary(
      transformationTest,
      librariesTest
    );
    console.log(res.data);
  } catch (err) {
    core.error(err);
  }
}

test();
