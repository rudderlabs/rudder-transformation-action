const axios = require("axios");
const core = require("@actions/core");
const serverEndpoint = core.getInput("serverEndpoint");
const createTransformerEndpoint = `${serverEndpoint}/transformations`;
const createLibraryEndpoint = `${serverEndpoint}/libraries`;
const testEndpoint = `${serverEndpoint}/transformations/libraries/publish`;

async function createTransformer(name, description, code) {
  //console.log(code)
  return axios.default.post(
    `${createTransformerEndpoint}?publish=false`,
    {
      name,
      description,
      code
    },
    {
      auth: {
        username: core.getInput("email"),
        password: core.getInput("accessKey")
      }
    }
  );
}

async function createLibrary(name, description, code) {
  return axios.default.post(
    `${createLibraryEndpoint}?publish=false`,
    {
      name,
      description,
      code
    },
    {
      auth: {
        username: core.getInput("email"),
        password: core.getInput("accessKey")
      }
    }
  );
}

async function testTransformationAndLibrary(transformations, libraries) {
  return axios.default.post(
    `${testEndpoint}`,
    {
      transformations,
      libraries
    },
    {
      auth: {
        username: core.getInput("email"),
        password: core.getInput("accessKey")
      }
    }
  );
}

module.exports = {
  createTransformer,
  createLibrary,
  testTransformationAndLibrary
};
