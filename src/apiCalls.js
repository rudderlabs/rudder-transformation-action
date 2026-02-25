const axios = require("axios");
const { getPlatform } = require("./platform");

const platform = getPlatform();

/**
 * Validates the server endpoint URL.
 * - Must use HTTPS.
 * - Must be a syntactically valid URL.
 * - Returns the URL with trailing slashes stripped.
 * @param {string} endpoint
 * @returns {string}
 */
function validateEndpoint(endpoint) {
  let parsed;
  try {
    parsed = new URL(endpoint);
  } catch {
    throw new Error(`Invalid serverEndpoint URL: "${endpoint}"`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error(
      `serverEndpoint must use HTTPS. Got: "${parsed.protocol}//${parsed.host}"`,
    );
  }
  return endpoint.replace(/\/+$/, "");
}

const rawEndpoint =
  platform.getInput("serverEndpoint") || "https://api.rudderstack.com";
const serverEndpoint = validateEndpoint(rawEndpoint);

// Single configured axios instance shared by all API functions.
// Auth credentials are read once at startup; timeout is 60 s.
const client = axios.create({
  baseURL: serverEndpoint,
  auth: {
    username: platform.getInput("email"),
    password: platform.getInput("accessToken"),
  },
  headers: { "user-agent": "transformationAction" },
  timeout: 60000,
});

async function getAllTransformations() {
  platform.info("Getting all transformations from upstream");
  return client.get("/transformations");
}

async function getAllLibraries() {
  platform.info("Getting all libraries from upstream");
  return client.get("/libraries");
}

async function createTransformation(name, description, code, language) {
  platform.info(`Creating transformation: ${name}`);
  return client.post("/transformations?publish=false", {
    name,
    description,
    code,
    language,
  });
}

async function updateTransformation(id, name, description, code, language) {
  platform.info(`Updating transformation: ${name}`);
  return client.post(`/transformations/${id}?publish=false`, {
    description,
    code,
    language,
  });
}

async function createLibrary(name, description, code, language) {
  platform.info(`Creating library: ${name}`);
  return client.post("/libraries?publish=false", {
    name,
    description,
    code,
    language,
  });
}

async function updateLibrary(id, description, code, language) {
  platform.info(`Updating library: ${id}`);
  return client.post(`/libraries/${id}?publish=false`, {
    description,
    code,
    language,
  });
}

async function testTransformationAndLibrary(transformations, libraries) {
  platform.info("Testing transformations and libraries");
  return client.post("/transformations/libraries/test", {
    transformations,
    libraries,
  });
}

async function publish(transformations, libraries, commitId) {
  platform.info("Publishing transformations and libraries");
  return client.post("/transformations/libraries/publish", {
    transformations,
    libraries,
    commitId,
  });
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
