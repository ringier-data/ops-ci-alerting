module.exports = {
  roots: ['<rootDir>'],
  preset: 'ts-jest',
  transform: {
    "^.+\\.(ts|tsx)$": "ts-jest"
  },
  testRegex: '^.+\.test\\.tsx?$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  restoreMocks: true,
  collectCoverage: true,
  coveragePathIgnorePatterns: [
    '<rootDir>/dist/',
    '<rootDir>/node_modules/'
  ],
  coverageReporters: ['json-summary', 'text'],
  setupFiles: [],
  setupFilesAfterEnv: [
    './jest.setup.js'
  ]
};
