const axios = require("axios");

module.exports.getLink = async (payload) => {
    try {
        let url = `https://firebasedynamiclinks.googleapis.com/v1/shortLinks?key=${process.env.WEB_KEY}`;
        let data = {
            "dynamicLinkInfo": {
                "domainUriPrefix": process.env.DEEPLINK_PREFIX,
                "link": payload,
                "androidInfo": {
                    "androidPackageName": process.env.ANDROID_PACKAGE_NAME
                },
                "iosInfo": {
                    "iosBundleId": process.env.BUNDLE_ID
                }
            }
        };
        let link1 = "",
            error = "";
        let addDataJson = JSON.stringify(data);
        let hit = await axios.post(url, addDataJson, {
            headers: {
                'content-type': 'application/json'
            }
        }).then((ress) => {
            link1 = ress.data.shortLink;
            return link1;
        }).catch((err) => {
            error = err.message || err;
            console.log(error, "error");
            return error;
        });
        console.log(hit, "hit");
        return link1;

    } catch (error) {
        console.error(error);
    }
};