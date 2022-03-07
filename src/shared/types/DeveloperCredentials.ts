type DeveloperCredentials = {
  // canvasHost => credentials
  [k in string]: {
    clientId: string,
    clientSecret: string,
  }
};

export default DeveloperCredentials;
