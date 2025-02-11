module.exports = {
  extends: ["airbnb", "eslint:recommended"],
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
    semi: ["error", "always"],
    quotes: ["error", "double"],
    "no-restricted-syntax": ["error", "ForInStatement", "LabeledStatement", "WithStatement"],
    "no-continue": "off",
    "no-await-in-loop": "off",
  },
};
