const {
  getAllTransformations,
  getAllLibraries,
  testTransformationAndLibrary,
  createTransformation,
  createLibrary,
  updateTransformation,
  updateLibrary,
} = require("./apiCalls");
const { testAndPublish } = require("./main");

const fs = require("fs");
const path = require("path");

jest.mock("./apiCalls", () => ({
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

function readFile(path) {
  return JSON.parse(fs.readFileSync(path, "utf-8"));
}

describe("test and publish transformation and libraries successfully", () => {
  beforeEach(() => {
    try {
      fs.rmdirSync("./test-outputs", { force: true, recursive: true });
    } catch (err) {
      // Do nothing
    } finally {
      jest.clearAllMocks();
    }
  });

  it("should successfully run when we have no transformations to sync", async () => {
    // Arrange
    const metapath = "./src/testdata/emptymeta.json";
    getAllTransformations.mockResolvedValue([]);
    getAllLibraries.mockResolvedValue([]);
    testTransformationAndLibrary.mockResolvedValue({
      data: { result: { successTestResults: [], failedTestResults: [] } },
    });

    // Act and Assert
    await expect(testAndPublish(metapath)).resolves.toEqual(undefined);
  });

  it("should successfully publish new transformations and libraries", async () => {
    // Arrange
    const metapath = "./src/testdata/meta.json";
    getAllTransformations.mockResolvedValue([]);
    getAllLibraries.mockResolvedValue([]);
    createTransformation.mockResolvedValue({
      data: {
        id: "transformation_id_1",
        versionId: "transformation_version_id_1",
      },
    });
    createLibrary
      .mockReturnValueOnce({
        data: {
          id: "library_id_1",
          versionId: "library_version_id_1",
        },
      })
      .mockReturnValueOnce({
        data: {
          id: "library_id_2",
          versionId: "library_version_id_2",
        },
      });

    testTransformationAndLibrary.mockResolvedValue({
      data: {
        result: {
          successTestResults: [
            {
              transformerVersionID: "transformation_version_id_1",
              result: {
                output: {
                  transformedEvents: readFile("./src/testdata/expected.json"),
                },
              },
            },
          ],
          failedTestResults: [],
        },
      },
    });

    // Act
    await expect(testAndPublish(metapath)).resolves.toEqual(undefined);

    // Assert
    expect(createTransformation).toHaveBeenCalledTimes(1);
    expect(createLibrary).toHaveBeenCalledTimes(2);
    expect(readFile("./test-outputs/transformation1_output.json")).toEqual(
      readFile("./src/testdata/expected.json"),
    ); // actual file generated is as expected
  });

  it("should throw an error in case publish transformations and libraries result in diff", async () => {
    // Arrange
    const metapath = "./src/testdata/meta.json";
    getAllTransformations.mockResolvedValue([]);
    getAllLibraries.mockResolvedValue([]);
    createTransformation.mockResolvedValue({
      data: {
        id: "transformation_id_1",
        versionId: "transformation_version_id_1",
      },
    });
    createLibrary
      .mockReturnValueOnce({
        data: {
          id: "library_id_1",
          versionId: "library_version_id_1",
        },
      })
      .mockReturnValueOnce({
        data: {
          id: "library_id_2",
          versionId: "library_version_id_2",
        },
      });

    testTransformationAndLibrary.mockResolvedValue({
      data: {
        result: {
          successTestResults: [
            {
              transformerVersionID: "transformation_version_id_1",
              result: {
                output: {
                  transformedEvents: [
                    {
                      revenue: 1, // wrong value here
                      price: 1, // wrong value here
                      profit: 0,
                      city: "Kolkata",
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
                },
              },
            },
          ],
          failedTestResults: [],
        },
      },
    });

    // Act and Assert
    await expect(testAndPublish(metapath)).rejects.toThrow(
      "Test output do not match for transformation: Transformation_1",
    );

    expect(readFile("./src/testdata/expected_diff.json")).toEqual(
      readFile("./test-outputs/transformation1_diff.json"),
    );
  });

  it("should successfully update existing transformations and libraries", async () => {
    // Arrange
    const metapath = "./src/testdata/meta.json";
    getAllTransformations.mockResolvedValue({
      data: {
        transformations: [
          { name: "Transformation_1", id: "transformation_id_1" },
        ],
      },
    });
    getAllLibraries.mockResolvedValue({
      data: {
        libraries: [
          { name: "getFinanceData", id: "library_id_1" },
          { name: "getUserAddress", id: "library_id_2" },
        ],
      },
    });

    updateTransformation.mockResolvedValue({
      data: {
        id: "transformation_id_1",
        versionId: "transformation_version_id_1",
      },
    });

    updateLibrary
      .mockReturnValueOnce({
        data: {
          id: "library_id_1",
          versionId: "library_version_id_1",
        },
      })
      .mockReturnValueOnce({
        data: {
          id: "library_id_2",
          versionId: "library_version_id_2",
        },
      });

    testTransformationAndLibrary.mockResolvedValue({
      data: {
        result: {
          successTestResults: [
            {
              transformerVersionID: "transformation_version_id_1",
              result: {
                output: {
                  transformedEvents: [
                    {
                      revenue: 0,
                      price: 0,
                      profit: 0,
                      city: "Kolkata",
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
                },
              },
            },
          ],
          failedTestResults: [],
        },
      },
    });

    await expect(testAndPublish(metapath)).resolves.toEqual(undefined);
    expect(updateTransformation).toHaveBeenCalledTimes(1);
    expect(updateLibrary).toHaveBeenCalledTimes(2);
    expect(readFile("./test-outputs/transformation1_output.json")).toEqual(
      readFile("./src/testdata/expected.json"),
    ); // actual file generated is as expected
  });

  it("should throw an error in case testing the transformations / libraries fails", async() => {
    const metapath = "./src/testdata/meta.json";

    getAllTransformations.mockResolvedValue({
      data: {
        transformations: [
          { name: "Transformation_1", id: "transformation_id_1" },
        ],
      },
    });

    getAllLibraries.mockResolvedValue({
      data: {
        libraries: [
          { name: "getFinanceData", id: "library_id_1" },
          { name: "getUserAddress", id: "library_id_2" },
        ],
      },
    });

    updateTransformation.mockResolvedValue({
      data: {
        id: "transformation_id_1",
        versionId: "transformation_version_id_1",
      },
    });

    updateLibrary
    .mockReturnValueOnce({
      data: {
        id: "library_id_1",
        versionId: "library_version_id_1",
      },
    })
    .mockReturnValueOnce({
      data: {
        id: "library_id_2",
        versionId: "library_version_id_2",
      },
    });

    testTransformationAndLibrary.mockResolvedValue({
      data: {
        result: {
          successTestResults: [
          ],
          failedTestResults: [
            {
              id : "transformation-id",
              name: "some-upstream-transformation",
              error: '{"success": false, "error": "some error message"}',
            }
          ],
        },
      },
    });

    await expect(testAndPublish(metapath)).rejects.toThrow(
      "Failures occured while running tests against input events",
    );
  });

  it ("should handle case when library is connected to transformations not managed within the workflow", async() => {
    const metapath = "./src/testdata/meta.json";

    getAllTransformations.mockResolvedValue({
      data: {
        transformations: [
          { name: "Transformation_1", id: "transformation_id_1" },
        ],
      },
    });

    getAllLibraries.mockResolvedValue({
      data: {
        libraries: [
          { name: "getFinanceData", id: "library_id_1" },
          { name: "getUserAddress", id: "library_id_2" },
        ],
      },
    });

    updateTransformation.mockResolvedValue({
      data: {
        id: "transformation_id_1",
        versionId: "transformation_version_id_1",
      },
    });

    updateLibrary
      .mockReturnValueOnce({
        data: {
          id: "library_id_1",
          versionId: "library_version_id_1",
        },
      })
      .mockReturnValueOnce({
        data: {
          id: "library_id_2",
          versionId: "library_version_id_2",
        },
      });

      testTransformationAndLibrary.mockResolvedValue({
        data: {
          result: {
            successTestResults: [
              {
                transformerVersionID: "transformation_version_id_1",
                result: {
                  output: {
                    transformedEvents: [
                      {
                        revenue: 0,
                        price: 0,
                        profit: 0,
                        city: "Kolkata",
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
                  },
                },
              },
              {
                transformerVersionID: "other_connection_transformation_version_id",
                result: {
                  output: {
                    transformedEvents: [{}],
                  },
                },
              },
            ],
            failedTestResults: [],
          },
        },
      });

      await expect(testAndPublish(metapath)).resolves.toEqual(undefined);
    
  });

});
