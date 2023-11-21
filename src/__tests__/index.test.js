const fs = require("fs");
const {
  getTransformationsAndLibrariesFromLocal,
  buildNameToIdMap,
  loadTransformationsAndLibraries,
  upsertTransformations,
  upsertLibraries,
} = require("../index");

describe("getTransformationsAndLibrariesFromLocal", () => {
  // metalFilePath address
  const metaFilePath = "./src/code/meta.json";

  it("should load transformations and libraries from the meta file", () => {
    // Call the function
    const result = getTransformationsAndLibrariesFromLocal(metaFilePath);

    // Assert the result
    expect(result).toEqual({
      transformations: [
        {
          file: "./src/code/code.js",
          name: "Transformation1",
          description: "Description 1",
          language: "javascript",
          "test-input-file": "./src/code/events.json",
          "expected-output": "./src/code/expected.json",
        },
        {
          file: "./src/code/code2.js",
          name: "Transformation2",
          description: "Description 2",
          language: "javascript",
          "test-input-file": "./src/code/events.json",
          "expected-output": "./src/code/expected.json",
        },
      ],
      libraries: [
        {
          file: "./src/code/lib1.js",
          name: "getFinanceData",
          description: "javascript library to get finance data",
          language: "javascript",
        },
        {
          file: "./src/code/lib2.js",
          name: "getUserAddress",
          description: "javascript library to get user address",
          language: "javascript",
        },
      ],
    });
  });

  it("should handle errors when reading the meta file", () => {
    const metaFilePath = "./meta.json";

    // Call the function
    const result = () => getTransformationsAndLibrariesFromLocal(metaFilePath);

    console.log({ result });
    // Assert the result
    expect(result).toThrowError(
      `ENOENT: no such file or directory, open '${metaFilePath}'`
    );
  });
});

describe("buildNameToIdMap", () => {
  it("should build a name-to-id map from an array of objects", () => {
    // Arrange
    const workspaceTransformations = [
      {
        id: "2Y7OF8oTCk3EzvNdEhH4pZG1SUx",
        versionId: "2Y7OaZu6BQev1e51DpIHxCWmEV2",
        name: "Transformation2",
        description: "Description 2",
        code:
          "export function transformEvent(event, metadata) {\n" +
          "    // log(event.a.b);\n" +
          "    return event;\n" +
          "  }\n" +
          "  ",
        codeVersion: "1",
        language: "javascript",
        createdAt: "2023-11-13T10:57:24.325Z",
        updatedAt: "2023-11-13T11:00:15.476Z",
        destinations: [],
      },
      {
        id: "2Y7OF2RiChcOK8RCBglE9w3J1ZO",
        versionId: "2Y7OaSqpk6qTZDFYu6iNP01lH4x",
        name: "Transformation1",
        description: "Description 1",
        code:
          "export function transformEvent(event, metadata) {\n" +
          "  // log(event.a.b);\n" +
          "  return event;\n" +
          "}\n",
        codeVersion: "1",
        language: "javascript",
        createdAt: "2023-11-13T10:57:23.431Z",
        updatedAt: "2023-11-13T11:00:14.781Z",
        destinations: [],
      },
      {
        id: "2VIHsCfbrgcUa4skOyP6psIbfDy",
        versionId: "2VITbuIVHzSVJwqdpxnhcGY6n2t",
        name: "test-transformation",
        description: "",
        code:
          "/***  \n" +
          "* This is a custom transformation template for building transformations from scratch.\n" +
          "* Learn more by visiting https://www.rudderstack.com/docs/features/transformations/templates/\n" +
          "***/\n" +
          "\n" +
          "export function transformEvent(event, metadata) {\n" +
          '    if (event.type == "track")\n' +
          "    return event;\n" +
          "}",
        codeVersion: "1",
        language: "javascript",
        createdAt: "2023-09-12T11:07:58.507Z",
        updatedAt: "2023-09-12T12:49:35.250Z",
        destinations: [Array],
      },
    ];

    // Act
    const result = buildNameToIdMap(workspaceTransformations);

    // Assert
    expect(result).toEqual({
      Transformation1: "2Y7OF2RiChcOK8RCBglE9w3J1ZO",
      Transformation2: "2Y7OF8oTCk3EzvNdEhH4pZG1SUx",
      "test-transformation": "2VIHsCfbrgcUa4skOyP6psIbfDy",
    });
  });

  it("should handle an empty array", () => {
    // Arrange
    const inputArray = [];

    // Act
    const result = buildNameToIdMap(inputArray);

    // Assert
    expect(result).toEqual({});
  });

  // Add more test cases based on the behavior of your function
});

describe("loadTransformationsAndLibraries", () => {
  it("should load transformations and libraries successfully", async () => {
    // Call the function
    const result = await loadTransformationsAndLibraries();

    console.log({ result: JSON.stringify(result) });

    // Assert the expected results
    expect(result.workspaceTransformations.length).toBeGreaterThan(0);
    expect(result.workspaceLibraries.length).toBeGreaterThan(0);
  });


});

describe("upsertTransformations", () => {
    it("should update existing transformations", async () => {
      // Arrange
      const transformations = [
        {
          name: "Transformation1",
          description: "Description 5",
          file: "./src/code/code.js",
          language: "javascript",
        },
      ];
  
      const transformationNameToId = {
        Transformation1: "2Y7OF2RiChcOK8RCBglE9w3J1ZO", // Assuming this id exists for the update case
      };
  
      // Act
      const result = await upsertTransformations(
        transformations,
        transformationNameToId
      );
  
      // Assert
      const versionId = Object.keys(result)[0]; // Assuming there's only one entry in the result
      expect(result[versionId]).toEqual(
        expect.objectContaining({
          name: "Transformation1",
          description: "Description 5",
          file: "./src/code/code.js",
          language: "javascript",
          id: "2Y7OF2RiChcOK8RCBglE9w3J1ZO",
        })
      );
    });
  });
  

describe("upsertLibraries", () => {
  it("should update existing libraries", async () => {
    // Arrange
    const libraries = [
      {
        name: "New Library",
        description: "Description 1",
        file: "./src/code/lib1.js",
        language: "javascript",
      },
    ];

    const libraryNameToId = {
      "New Library": "2Y7OU4R2m34rPrYUQ9Blam0uj35", // Assuming this id exists for the update case
    };

    // Act
    const result = await upsertLibraries(libraries, libraryNameToId);

    console.log(result);
    const versionId = Object.keys(result)[0]; // Assuming there's only one entry in the result
    expect(result[versionId]).toEqual(
      expect.objectContaining({
        name: "New Library",
        description: "Description 1",
        file: "./src/code/lib1.js",
        language: "javascript",
      })
    );
  });
});