declare type DeveloperCredentials = {
    [k in string]: {
        client_id: string;
        client_secret: string;
    };
};
export default DeveloperCredentials;
