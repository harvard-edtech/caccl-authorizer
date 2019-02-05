require('dce-selenium');

itd('App certs accepted', async function (driver) {
  driver.log('use "npm run accept" if certificates are failing');
  await driver.visit('https://localhost:8089/verifycert');
});

itd('Canvas partial simulator certs accepted', async function (driver) {
  driver.log('use "npm run accept" if certificates are failing');
  await driver.visit('https://localhost:8089/verifycert');
});
