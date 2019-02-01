require('dce-selenium');

itd('App certs accepted', async function (driver) {
  await driver.visit('https://localhost:8089/verifycert');
});

itd('Canvas partial simulator certs accepted', async function (driver) {
  await driver.visit('https://localhost:8089/verifycert');
});
