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
console.log("---transformations---", transformations);
console.log("----libraries---", libraries);

async function test() {
  const transformationDict = {};
  const libraryDict = {};

  try {
    for (let i = 0; i < transformations.length; i++) {
      let tr = transformations[i];
      let code = fs.readFileSync(tr.file, "utf-8");
      let res = await createTransformer(tr.name, tr.description, code);
      transformationDict[res.data.versionId] = { ...tr, id: res.data.id };
      console.log("creating transformation");
    }

    // await transformations.forEach(async tr => {
    //   let code = fs.readFileSync(tr.file, "utf-8");
    //   let res = await createTransformer(tr.name, tr.description, code);
    //   transformationDict[res.data.versionId] = { ...tr, id: res.data.id };
    //   console.log("creating transformation");
    // });

    console.log("transformation done!");

    for (let i = 0; i < libraries.length; i++) {
      let lib = libraries[i];
      let code = fs.readFileSync(lib.file, "utf-8");
      let res = await createLibrary(lib.name, lib.description, code);
      libraryDict[res.data.versionId] = { ...lib, id: res.data.id };
      console.log("creating library");
    }

    // await libraries.forEach(async lib => {
    //   let code = fs.readFileSync(lib.file, "utf-8");
    //   let res = await createLibrary(lib.name, lib.description, code);
    //   libraryDict[res.data.versionId] = { ...lib, id: res.data.id };
    //   console.log("creatingg library");
    // });

    console.log("library done!");

    let transformationTest = [];
    let librariesTest = [];

    for (let i = 0; i < Object.keys(transformationDict).length; i++) {
      let trVersionId = Object.keys(transformationDict)[i];
      let testInputPath = transformationDict[trVersionId]["test-input-file"];
      let testInput = JSON.parse(fs.readFileSync(testInputPath));
      transformationTest.push({ versionId: trVersionId, testInput });
    }

    // await Object.keys(transformationDict).forEach(async trVersionId => {
    //   let testInputPath = transformationDict[trVersionId]["test-input-file"];
    //   let testInput = JSON.parse(fs.readFileSync(testInputPath));
    //   transformationTest.push({ versionId: trVersionId, testInput });
    // });

    for (let i = 0; i < Object.keys(libraryDict).length; i++) {
      librariesTest.push({ versionId: Object.keys(libraryDict)[i] });
    }

    // Object.keys(libraryDict).forEach(libVersionId => {
    //   librariesTest.push({ versionId: libVersionId });
    // });

    console.log("final transformation------", transformationTest);
    console.log("final library-----", librariesTest);

    let res = await testTransformationAndLibrary(
      transformationTest,
      librariesTest
    );
    console.log(res.data);
  } catch (err) {
    if (err.response) {
      console.log(err.response.data);
      console.log(err.response.status);
      core.error(err);
    }
  }
}

test();
