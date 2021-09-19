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
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 75,
      lines: 75,
      statements: 75
    }
  },
  setupFiles: [],
  setupFilesAfterEnv: [
    './jest.setup.js'
  ]
};
