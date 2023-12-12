const fs = require("fs");
const {
  testAndPublish,
  getTransformationsAndLibrariesFromLocal,
} = require("../index");

const apiCalls = require("../apiCalls");
const { isEqual } = require("lodash");

jest.mock("../apiCalls");

// Mock the @actions/core module
jest.mock("@actions/core", () => {
  const coreMock = {
    info: jest.fn(),
    warn: jest.fn(),
    getInput: jest.fn(),
  };
  return coreMock;
});

const testOutputDir = "./test-outputs";

describe("testAndPublish", () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  test("should test and publish successfully", async () => {
    const mockTransformationsAndLibraries = {
      transformations: [
        {
          file: "./src/code/code.js",
          name: "Transformation1",
          description: "Description 1",
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
    };

    // Mock only the necessary API calls
    const mockTransformationsResponse = {
      data: {
        transformations: [
          {
            file: "./src/code/code.js",
            name: "Transformation1",
            description: "Description 1",
            language: "javascript",
            "test-input-file": "./src/code/events.json",
            "expected-output": "./src/code/expected.json",
          },
        ],
      },
    };
    const mockLibrariesResponse = {
      data: {
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
      },
    };

    const mockUpdateTransformationResponse = {
      data: {
        versionId: "2ZQtM5EBkb793Ojp0tMouy2picS",
        id: "mockedId",
      },
    };
    const mockUpdateLibraryResponse = {
      data: {
        versionId: "mockedVersionId",
        id: "mockedId",
      },
    };

    const mockTestTransformationAndLibraryResponse = {
      data: {
        result: {
          successTestResults: [
            {
              transformerVersionID: "2ZQtM5EBkb793Ojp0tMouy2picS",
              result: {
                success: true,
                output: {
                  transformedEvents: [
                    {
                      revenue: 0,
                      price: 0,
                      profit: 0,
                      city: "Kolkatas",
                      country: "India",
                      street: "330/8",
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
    };

    const mockPublishResponse = {
      data: {},
    };

    // Mock the API calls
    jest
      .spyOn(apiCalls, "getAllTransformations")
      .mockResolvedValue(mockTransformationsResponse);
    jest
      .spyOn(apiCalls, "getAllLibraries")
      .mockResolvedValue(mockLibrariesResponse);
    jest
      .spyOn(apiCalls, "createTransformation")
      .mockResolvedValue(mockUpdateTransformationResponse);
    jest
      .spyOn(apiCalls, "updateTransformation")
      .mockResolvedValue(mockUpdateTransformationResponse);
    jest
      .spyOn(apiCalls, "createLibrary")
      .mockResolvedValue(mockUpdateLibraryResponse);
    jest
      .spyOn(apiCalls, "updateLibrary")
      .mockResolvedValue(mockUpdateLibraryResponse);
    jest
      .spyOn(apiCalls, "testTransformationAndLibrary")
      .mockResolvedValue(mockTestTransformationAndLibraryResponse);
    jest.spyOn(apiCalls, "publish").mockResolvedValue(mockPublishResponse);

    await testAndPublish("./src/code/meta.json");

    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir);
    }
    const transormation_diff_file = JSON.parse(
      fs.readFileSync(testOutputDir + "/transformation1_diff.json")
    );

    // Assert that the transformation_diff_file is equal to the expected value
    expect(transormation_diff_file).toEqual({
      added: {},
      deleted: {},
      updated: {
        0: {
          city: "Kolkatas",
        },
      },
    });
  });
});
