const axios = require("axios");
const core = require("@actions/core");
const serverEndpoint =
  core.getInput("serverEndpoint") || "https://api.rudderstack.com";
const createTransformerEndpoint = `${serverEndpoint}/transformations`;
const createLibraryEndpoint = `${serverEndpoint}/libraries`;
const testEndpoint = `${serverEndpoint}/transformations/libraries/test`;
const publishEndpoint = `${serverEndpoint}/transformations/libraries/publish`;
const listTransformationsEndpoint = `${serverEndpoint}/transformations`;
const listLibrariesEndpoint = `${serverEndpoint}/libraries`;

async function getAllTransformations() {
  return axios.default.get(listTransformationsEndpoint, {
    auth: {
      username: core.getInput("email"),
      password: core.getInput("accessToken"),
    },
    headers: {
      "user-agent": "transformationAction",
    },
  });
}

async function getAllLibraries() {
  return axios.default.get(listLibrariesEndpoint, {
    auth: {
      username: core.getInput("email"),
      password: core.getInput("accessToken"),
    },
    headers: {
      "user-agent": "transformationAction",
    },
  });
}

async function createTransformation(name, description, code, language) {
  core.info(`Created transformation: ${name}`);
  return axios.default.post(
    `${createTransformerEndpoint}?publish=false`,
    {
      name,
      description,
      code,
      language,
    },
    {
      auth: {
        username: core.getInput("email"),
        password: core.getInput("accessToken"),
      },
      headers: {
        "user-agent": "transformationAction",
      },
    }
  );
}

async function updateTransformation(id, name, description, code, language) {
  core.info(`Updated transformation: ${name}`);
  return axios.default.post(
    `${createTransformerEndpoint}/${id}?publish=false`,
    {
      description,
      code,
      language,
    },
    {
      auth: {
        username: core.getInput("email"),
        password: core.getInput("accessToken"),
      },
      headers: {
        "user-agent": "transformationAction",
      },
    }
  );
}

async function createLibrary(name, description, code, language) {
  return axios.default.post(
    `${createLibraryEndpoint}?publish=false`,
    {
      name,
      description,
      code,
      language,
    },
    {
      auth: {
        username: core.getInput("email"),
        password: core.getInput("accessToken"),
      },
      headers: {
        "user-agent": "transformationAction",
      },
    }
  );
}

async function updateLibrary(id, description, code, language) {
  return axios.default.post(
    `${createLibraryEndpoint}/${id}?publish=false`,
    {
      description,
      code,
      language,
    },
    {
      auth: {
        username: core.getInput("email"),
        password: core.getInput("accessToken"),
      },
      headers: {
        "user-agent": "transformationAction",
      },
    }
  );
}

async function testTransformationAndLibrary(transformations, libraries) {
  return axios.default.post(
    `${testEndpoint}`,
    {
      transformations,
      libraries,
    },
    {
      auth: {
        username: core.getInput("email"),
        password: core.getInput("accessToken"),
      },
      headers: {
        "user-agent": "transformationAction",
      },
    }
  );
}

async function publish(transformations, libraries, commitId) {
  return axios.default.post(
    `${publishEndpoint}`,
    {
      transformations,
      libraries,
      commitId,
    },
    {
      auth: {
        username: core.getInput("email"),
        password: core.getInput("accessToken"),
      },
      headers: {
        "user-agent": "transformationAction",
      },
    }
  );
}

module.exports = {
  getAllTransformations,
  getAllLibraries,
  createTransformation,
  createLibrary,
  updateTransformation,
  updateLibrary,
  testTransformationAndLibrary,
  publish,
};
