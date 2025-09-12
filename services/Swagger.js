const postmanToOpenApi = require('postman-to-openapi');

module.exports.createSwagger = async () => {
    try {
        const postmanCollection = "./swagger/collection.json";
        const outputFile = './swagger/collection.yml';
        await postmanToOpenApi(postmanCollection, outputFile, {
            defaultTag: 'General'
        });
        // Without save the result in a file
        await postmanToOpenApi(postmanCollection, null, {
            defaultTag: 'General'
        });
        console.log("Swagger file created");
        return true;
    } catch (error) {
        console.error(error);
    }
};