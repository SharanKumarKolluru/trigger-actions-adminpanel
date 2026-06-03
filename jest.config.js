const { jestConfig } = require("@salesforce/sfdx-lwc-jest/config");

module.exports = {
  ...jestConfig,
  modulePathIgnorePatterns: ["<rootDir>/.localdevserver"],
  transformIgnorePatterns: ["/node_modules/(?!(@apexdevtools\\/apex-parser)/)"]
};
