// Imports
const fs = require("fs");
const {
  getTransformationsAndLibrariesFromLocal,
  buildNameToIdMap,
  loadTransformationsAndLibraries,
  upsertTransformations,
  upsertLibraries,
  buildTestSuite,
  testAndPublish,
} = require("../main");
const {
  getAllTransformations,
  getAllLibraries,
  createTransformation,
  createLibrary,
  updateTransformation,
  updateLibrary,
  testTransformationAndLibrary,
  publish,
} = require("../apiCalls");

// Mock fs module
jest.mock("fs");

// Mock API calls
jest.mock("../apiCalls", () => ({
  getAllTransformations: jest.fn(),
  getAllLibraries: jest.fn(),
  updateTransformation: jest.fn(),
  createTransformation: jest.fn(),
  createLibrary: jest.fn(),
  updateLibrary: jest.fn(),
  testTransformationAndLibrary: jest.fn(),
}));

// Mock the @actions/core module
jest.mock("@actions/core", () => {
  const coreMock = {
    info: jest.fn(),
    warn: jest.fn(),
    getInput: jest.fn(),
  };
  return coreMock;
});

// Clear mocks before each test case
beforeEach(() => {
  jest.clearAllMocks();
});

describe("getTransformationsAndLibrariesFromLocal", () => {
  it("should load transformations and libraries from the meta file", () => {
    // Mock the fs.readFileSync method
    fs.readFileSync.mockReturnValue(
      JSON.stringify({
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
      })
    );

    // Call the function
    const result = getTransformationsAndLibrariesFromLocal();

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
});

describe("loadTransformationsAndLibraries", () => {
  it("should load transformations and libraries successfully", async () => {
    // Arrange
    const mockTransformations = [
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
    ];

    const mockLibraries = [
      {
        id: "2Y7OU4R2m34rPrYUQ9Blam0uj35",
        versionId: "2Y7OadXp1HbnqznZUQomGvVCyzF",
        name: "New Library",
        description: "javascript library to get finance data",
        code:
          "export function getPrice(finance) {\n" +
          "    return Number(finance.price || 0);\n" +
          "  }\n" +
          "  export function getRevenue(finance) {\n" +
          "    return Number(finance.revenue || 0);\n" +
          "  }\n" +
          "  export function getProfit(finance) {\n" +
          "    return getPrice(finance) - getRevenue(finance);\n" +
          "  }",
        language: "javascript",
        createdAt: "2023-11-13T10:59:23.582Z",
        updatedAt: "2023-11-13T11:00:15.830Z",
        importName: "newLibrary",
      },
    ];

    // Mock
    getAllTransformations.mockResolvedValue({
      data: { transformations: mockTransformations },
    });
    getAllLibraries.mockResolvedValue({ data: { libraries: mockLibraries } });

    // Act
    const result = await loadTransformationsAndLibraries();

    // Assert
    expect(result.workspaceTransformations).toEqual(mockTransformations);
    expect(result.workspaceLibraries).toEqual(mockLibraries);
  });

  it("should handle API call failure for transformations", async () => {
    const mockLibraries = [
      {
        id: "2Y7OU4R2m34rPrYUQ9Blam0uj35",
        versionId: "2Y7OadXp1HbnqznZUQomGvVCyzF",
        name: "New Library",
        description: "javascript library to get finance data",
        code:
          "export function getPrice(finance) {\n" +
          "    return Number(finance.price || 0);\n" +
          "  }\n" +
          "  export function getRevenue(finance) {\n" +
          "    return Number(finance.revenue || 0);\n" +
          "  }\n" +
          "  export function getProfit(finance) {\n" +
          "    return getPrice(finance) - getRevenue(finance);\n" +
          "  }",
        language: "javascript",
        createdAt: "2023-11-13T10:59:23.582Z",
        updatedAt: "2023-11-13T11:00:15.830Z",
        importName: "newLibrary",
      },
    ];

    getAllLibraries.mockResolvedValue({ data: { libraries: mockLibraries } });
    // Arrange
    getAllTransformations.mockRejectedValue(
      new Error("Transformations API error")
    );

    // Act and Assert
    await expect(loadTransformationsAndLibraries()).rejects.toThrow(
      "Transformations API error"
    );
  });

  it("should handle API call failure for libraries", async () => {
    const mockTransformations = [
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
    ];

    getAllTransformations.mockResolvedValue({
      data: { transformations: mockTransformations },
    });
    // Arrange
    getAllLibraries.mockRejectedValue(new Error("Libraries API error"));

    // Act and Assert
    await expect(loadTransformationsAndLibraries()).rejects.toThrow(
      "Libraries API error"
    );
  });
});

describe("upsertTransformations", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it("should update existing transformations", async () => {
    // Arrange
    const transformations = [
      {
        name: "ExistingTransformation",
        description: "Description 1",
        file: "./src/code/code.js",
        language: "javascript",
      },
    ];

    const transformationNameToId = {
      ExistingTransformation: "existingId", // Assuming this id exists for the update case
    };

    // Mock updateTransformation API call
    updateTransformation.mockResolvedValue({
      data: { versionId: "newVersionId", id: "existingId" },
    });

    // Act
    const result = await upsertTransformations(
      transformations,
      transformationNameToId
    );

    // Assert
    expect(result).toEqual({
      newVersionId: {
        name: "ExistingTransformation",
        description: "Description 1",
        file: "./src/code/code.js",
        language: "javascript",
        id: "existingId",
      },
    });
  });

  it("should create new transformations", async () => {
    // Arrange
    const transformations = [
      {
        name: "NewTransformation",
        description: "Description 2",
        file: "./src/code/code2.js",
        language: "javascript",
      },
    ];

    const transformationNameToId = {};

    // Mock createTransformation API call
    createTransformation.mockResolvedValue({
      data: { versionId: "newVersionId", id: "newId" },
    });

    // Act
    const result = await upsertTransformations(
      transformations,
      transformationNameToId
    );

    // Assert
    expect(result).toEqual({
      newVersionId: {
        name: "NewTransformation",
        description: "Description 2",
        file: "./src/code/code2.js",
        language: "javascript",
        id: "newId",
      },
    });
  });
});

describe("upsertLibraries", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should update existing libraries", async () => {
    // Arrange
    const libraries = [
      {
        name: "Library1",
        description: "Description 1",
        file: "./src/code/lib1.js",
        language: "javascript",
      },
    ];

    const libraryNameToId = {
      Library1: "existingLibraryId", // Assuming this id exists for the update case
    };

    // Mock updateLibrary API call
    updateLibrary.mockResolvedValue({
      data: {
        versionId: "newVersionId",
        id: "existingLibraryId",
      },
    });

    // Act
    const result = await upsertLibraries(libraries, libraryNameToId);

    // Assert
    expect(result).toEqual({
      newVersionId: {
        name: "Library1",
        description: "Description 1",
        file: "./src/code/lib1.js",
        language: "javascript",
        id: "existingLibraryId",
      },
    });
  });

  it("should create new libraries", async () => {
    // Arrange
    const libraries = [
      {
        name: "NewLibrary",
        description: "Description 2",
        file: "./src/code/lib2.js",
        language: "javascript",
      },
    ];

    const libraryNameToId = {}; // Empty object indicating no existing library

    // Mock createLibrary API call
    createLibrary.mockResolvedValue({
      data: {
        versionId: "newVersionId",
        id: "newLibraryId",
      },
    });

    // Act
    const result = await upsertLibraries(libraries, libraryNameToId);

    // Assert
    expect(result).toEqual({
      newVersionId: {
        name: "NewLibrary",
        description: "Description 2",
        file: "./src/code/lib2.js",
        language: "javascript",
        id: "newLibraryId",
      },
    });
  });
});

describe("buildTestSuite", () => {
  it("should build the test suite with test input for transformations", async () => {
    // Arrange
    const transformationDict = {
      versionId1: {
        file: "../code/code.js",
        name: "Transformation1",
        description: "Description 1",
        language: "javascript",
        "test-input-file": "../code/events.json",
      },
    };

    const libraryDict = {
      versionId3: {
        name: "Library1",
        description: "Description 1",
        language: "javascript",
      },
    };

    // Mock the behavior of fs.readFileSync
    jest.spyOn(fs, "readFileSync").mockReturnValue(
      JSON.stringify([
        {
          userId: "Anshul user id",
          anonymousId: "anon-id-new",
          messageId: "message-id-1",
          context: {
            ip: "14.5.67.21",
            library: {
              name: "http",
            },
            traits: {
              address: {
                city: "Kolkata",
                country: "India",
              },
            },
          },
          timestamp: "2020-02-02T00:23:09.544Z",
        },
        {
          userId: "identified user id",
          anonymousId: "anon-id-new",
          messageId: "message-id-2",
          context: {
            ip: "14.5.67.21",
            library: {
              name: "http",
            },
            traits: {},
          },
          properties: {
            price: 20,
            revenue: 15,
          },
          timestamp: "2020-02-02T00:23:09.544Z",
        },
      ])
    );

    // Act
    const result = await buildTestSuite(transformationDict, libraryDict);

    // Assert
    expect(result.transformationTest).toEqual([
      {
        versionId: "versionId1",
        testInput: [
          {
            userId: "Anshul user id",
            anonymousId: "anon-id-new",
            messageId: "message-id-1",
            context: {
              ip: "14.5.67.21",
              library: {
                name: "http",
              },
              traits: {
                address: {
                  city: "Kolkata",
                  country: "India",
                },
              },
            },
            timestamp: "2020-02-02T00:23:09.544Z",
          },
          {
            userId: "identified user id",
            anonymousId: "anon-id-new",
            messageId: "message-id-2",
            context: {
              ip: "14.5.67.21",
              library: {
                name: "http",
              },
              traits: {},
            },
            properties: {
              price: 20,
              revenue: 15,
            },
            timestamp: "2020-02-02T00:23:09.544Z",
          },
        ],
      },
    ]);

    expect(result.librariesTest).toEqual([{ versionId: "versionId3" }]);
  });

  it("should build the test suite without test input for transformations", async () => {
    // Arrange
    const transformationDict = {
      versionId1: { name: "Transformation1" },
      versionId2: { name: "Transformation2" },
    };

    const libraryDict = {
      versionId3: { name: "Library1" },
      versionId4: { name: "Library2" },
    };

    // Act
    const result = await buildTestSuite(transformationDict, libraryDict);

    // Assert
    expect(result.transformationTest).toEqual([
      { versionId: "versionId1" },
      { versionId: "versionId2" },
    ]);

    expect(result.librariesTest).toEqual([
      { versionId: "versionId3" },
      { versionId: "versionId4" },
    ]);
  });
});

describe("Integration Tests", () => {
  it("should run the entire testing and publishing process", async () => {
    // Mock getAllTransformations API call
    getAllTransformations.mockResolvedValue({
      data: { transformations: [{ name: "TestTransformation" }] },
    });

    // Mock getAllLibraries API call
    getAllLibraries.mockResolvedValue({
      data: { libraries: [{ name: "TestLibrary" }] },
    });

    // Mock updateTransformation API call
    updateTransformation.mockImplementation(
      async (id, name, description, code, language) => {
        // Return a mock response with versionId and id
        return {
          data: {
            versionId: "mockVersionId",
            id: "mockId",
          },
        };
      }
    );

    // Mock createTransformation API call
    createTransformation.mockImplementation(
      async (name, description, code, language) => {
        // Return a mock response with versionId and id
        return {
          data: {
            versionId: "mockVersionId",
            id: "mockId",
          },
        };
      }
    );

    // Mock testTransformationAndLibrary API call
    testTransformationAndLibrary.mockResolvedValue({
      data: {
        result: {
          successTestResults: [
            {
              transformerVersionID: "2YZBN9AhlLh9XjtKozxHuF3NTSA",
              result: {
                success: true,
                output: {
                  transformedEvents: [
                    {
                      userId: "identified user id",
                      anonymousId: "anon-id-new",
                      messageId: "message-id-1",
                      context: {
                        ip: "14.5.67.21",
                        library: { name: "http" },
                        traits: {
                          address: { city: "Kolkata", country: "India" },
                        },
                      },
                      timestamp: "2020-02-02T00:23:09.544Z",
                    },
                    {
                      userId: "identified user id",
                      anonymousId: "anon-id-new",
                      messageId: "message-id-2",
                      context: {
                        ip: "14.5.67.21",
                        library: { name: "http" },
                        traits: {},
                      },
                      properties: { price: 20, revenue: 15 },
                      timestamp: "2020-02-02T00:23:09.544Z",
                    },
                  ],
                  logs: [],
                },
              },
            },
            {
              transformerVersionID: "2YZBNAYbi40hrogAua4PdgBPbMz",
              result: {
                success: true,
                output: {
                  transformedEvents: [
                    {
                      revenue: 0,
                      price: 0,
                      profit: 0,
                      city: "Kolkata",
                      country: "India",
                      street: "no data found",
                    },
                    {
                      revenue: 15,
                      price: 20,
                      profit: 5,
                      city: "no data found",
                      country: "no data found",
                      street: "no data found",
                    },
                  ],
                  logs: [],
                },
              },
            },
          ],
          failedTestResults: [],
        },
      },
    });

    // Mock the fs.readFileSync method
    fs.readFileSync.mockReturnValue('{"transformations": [], "libraries": []}');

    // Act
    await testAndPublish();
  });
});
