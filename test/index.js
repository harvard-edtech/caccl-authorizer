const fs = require('fs');
const path = require('path');
const runSelenium = require('dce-selenium/run');

const createAppCanvasPair = require('./helpers/createAppCanvasPair');

/* eslint-disable no-console */

/*------------------------------------------------------------------------*/
/*                               Mocha Tests                              */
/*------------------------------------------------------------------------*/
const startTime = new Date();
const replaceAll = (str, search, replacement) => {
  return str.replace(new RegExp(search, 'g'), replacement);
};
const timestamp = `${startTime.toLocaleDateString()} ${replaceAll(startTime.toLocaleTimeString(), ':', '-')}`;

const runTests = async (folderName) => {
  // Print
  console.log(`\n\nRunning tests in ${folderName}\n`);

  // Read configuration
  const configFilename = path.join(__dirname, 'selenium', folderName, 'config.js');
  /* eslint-disable global-require */
  /* eslint-disable import/no-dynamic-require */
  const config = require(configFilename);

  // Start app and canvas simulator
  await createAppCanvasPair(config);

  // Start tests
  await runSelenium({
    subfolder: folderName,
    snapshotTitle: timestamp + '/' + folderName,
  });
};

// Read all directories in selenium-tests
const isDirectory = (location) => {
  return fs.lstatSync(location).isDirectory();
};
const listDirectories = (location) => {
  return fs.readdirSync(location)
    .filter((folder) => {
      return isDirectory(path.join(location, folder));
    });
};
const dirs = listDirectories(path.join(__dirname, 'selenium'));
const runAllTests = async () => {
  /* eslint-disable no-await-in-loop */
  for (let i = 0; i < dirs.length; i++) {
    await runTests(dirs[i]);
  }
  process.exit(0);
};
runAllTests();
