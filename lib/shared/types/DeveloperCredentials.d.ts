declare type DeveloperCredentials = {
    [k in string]: {
        clientId: string;
        clientSecret: string;
    };
};
export default DeveloperCredentials;
