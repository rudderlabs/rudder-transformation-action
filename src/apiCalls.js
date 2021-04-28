const axios = require("axios");
const core = require("@actions/core");
const serverEndpoint = core.getInput("serverEndpoint") || 'https://api.rudderstack.com';
const createTransformerEndpoint = `${serverEndpoint}/transformations`;
const createLibraryEndpoint = `${serverEndpoint}/libraries`;
const testEndpoint = `${serverEndpoint}/transformations/libraries/test`;
const publishEndpoint = `${serverEndpoint}/transformations/libraries/publish`;
const listTransformationsEndpoint = `${serverEndpoint}/transformations`;
const listLibrariesEndpoint = `${serverEndpoint}/libraries`;

const testOnly = core.getInput("TEST_ONLY");
core.info(`env var ::: ${testOnly} ::: ${process.env}`); 

async function getAllTransformations() {
  return axios.default.get(listTransformationsEndpoint, {
    auth: {
      username: core.getInput("email"),
      password: core.getInput("accessKey")
    }
  });
}

async function getAllLibraries() {
  return axios.default.get(listLibrariesEndpoint, {
    auth: {
      username: core.getInput("email"),
      password: core.getInput("accessKey")
    }
  });
}

async function createTransformer(name, description, code) {
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

async function updateTransformer(id, description, code) {
  return axios.default.post(
    `${createTransformerEndpoint}/${id}?publish=false`,
    {
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

async function updateLibrary(id, description, code) {
  return axios.default.post(
    `${createLibraryEndpoint}/${id}?publish=false`,
    {
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

async function publish(transformations, libraries) {
  return axios.default.post(
    `${publishEndpoint}`,
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
  getAllTransformations,
  getAllLibraries,
  createTransformer,
  createLibrary,
  updateTransformer,
  updateLibrary,
  testTransformationAndLibrary,
  publish
};
