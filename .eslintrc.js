module.exports = {
  extends: ["airbnb", "prettier"],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: "module",
  },
  env: {
    browser: true,
    node: true,
    jest: true,
  },
  rules: {
    "no-restricted-syntax": ["error", "ForInStatement", "LabeledStatement", "WithStatement"],
    "no-continue": "off",
    "no-await-in-loop": "off",
  },
};
