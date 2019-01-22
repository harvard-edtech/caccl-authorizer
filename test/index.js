const { exec } = require('child_process');

const createAppCanvasPair = require('./helpers/createAppCanvasPair');

/* eslint-disable no-console */

createAppCanvasPair()
  .then(() => {
    // App now set up!
    console.log('');
    console.log('Once we launch Cypress, you need to:');
    console.log('Click the "Run all specs" button on the top right');
    console.log('');
    console.log('When done running the tests, return to this window and press ctrl+c.');
    exec('$(npm bin)/cypress open', { stdio: 'inherit' });
  });
