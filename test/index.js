const Mocha = require('mocha');
const fs = require('fs');
const path = require('path');

const createAppCanvasPair = require('./helpers/createAppCanvasPair');

/* eslint-disable no-console */

/*------------------------------------------------------------------------*/
/*                               Mocha Tests                              */
/*------------------------------------------------------------------------*/

let numFailures = 0;
let backupDescribe;
const runTests = async (folderName) => {
  // Print
  const folderNameParts = folderName.split('/');
  console.log(`Running tests in ${folderNameParts[folderNameParts.length - 1]}`);

  // Read configuration
  const configFilename = path.join(folderName, 'config.js');
  /* eslint-disable global-require */
  /* eslint-disable import/no-dynamic-require */
  const config = require(configFilename);

  // Start app and canvas simulator
  await createAppCanvasPair(config);

  // Start Mocha tests
  // Instantiate a Mocha instance.
  const mocha = new Mocha({
    reporter: 'spec',
  });

  // Add each .js file to the mocha instance
  fs.readdirSync(folderName).filter((file) => {
    // Skip config.js
    if (file === 'config.js') {
      return false;
    }
    // Only keep the .js files
    return (file.substr(-3) === '.js');
  })
    .forEach((file) => {
      mocha.addFile(
        path.join(folderName, file)
      );
    });

  // Run the tests
  await new Promise((resolve) => {
    mocha.run((failures) => {
      numFailures += failures;
      if (!backupDescribe) {
        backupDescribe = global.describe;
      }
      resolve();
    });
  });
};

// Read all directories in selenium-tests
const isDirectory = (location) => {
  return fs.lstatSync(location).isDirectory();
};
const listDirectories = (location) => {
  return fs.readdirSync(location)
    .map((name) => {
      return path.join(location, name);
    })
    .filter(isDirectory);
};
const dirs = listDirectories(path.join(__dirname, 'selenium-tests'));
const runAllTests = async () => {
  /* eslint-disable no-await-in-loop */
  for (let i = 0; i < dirs.length; i++) {
    await runTests(dirs[i]);
  }
  // Print out number of failures
  if (numFailures === 0) {
    console.log('\nAll tests passed!');
  } else {
    console.log('\n' + '!'.repeat(10) + ' Notice: ' + '!'.repeat(10));
    console.log('\nSome tests failed!\nScroll back up through the many Mocha reports (each folder in test/selenium-tests runs separately) and find the errors.\n');
  }
  process.exit(0);
};
runAllTests();
