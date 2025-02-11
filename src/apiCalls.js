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

const defaultHeader = {
  "user-agent": "transformationAction",
};

async function getAllTransformations() {
  core.info("Getting all transformations from upstream");

  return axios.default.get(listTransformationsEndpoint, {
    auth: {
      username: core.getInput("email"),
      password: core.getInput("accessToken"),
    },
    headers: {
      ...defaultHeader,
    },
  });
}

async function getAllLibraries() {
  core.info("Getting all libraries from upstream");

  return axios.default.get(listLibrariesEndpoint, {
    auth: {
      username: core.getInput("email"),
      password: core.getInput("accessToken"),
    },
    headers: {
      ...defaultHeader,
    },
  });
}

async function createTransformation(name, description, code, language) {
  core.info(`Creating transformation: ${name}`);

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
        ...defaultHeader,
      },
    },
  );
}

async function updateTransformation(id, name, description, code, language) {
  core.info(`Updating transformation: ${name}`);

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
        ...defaultHeader,
      },
    },
  );
}

async function createLibrary(name, description, code, language) {
  core.info(`Creating library: ${name}`);

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
        ...defaultHeader,
      },
    },
  );
}

async function updateLibrary(id, description, code, language) {
  core.info(`Updating library: ${id}`);

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
        ...defaultHeader,
      },
    },
  );
}

async function testTransformationAndLibrary(transformations, libraries) {
  core.info("Testing transformations and libraries");

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
        ...defaultHeader,
      },
    },
  );
}

async function publish(transformations, libraries, commitId) {
  core.info("Publishing transformations and libraries");

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
        ...defaultHeader,
      },
    },
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
