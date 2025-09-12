const axios = require("axios");

//Distance between 2 coordinates using radius.
module.exports.calculateDistance = async (fromLat, fromLong, toLat, toLong) => {
    if ((fromLat == toLat) && (fromLong == toLong)) {
        return 0;
    } else {
        let radfromLat = Math.PI * fromLat / 180;
        let radtoLat = Math.PI * toLat / 180;
        let theta = fromLong - toLong;
        let radtheta = Math.PI * theta / 180;
        let dist = Math.sin(radfromLat) * Math.sin(radtoLat) + Math.cos(radfromLat) * Math.cos(radtoLat) * Math.cos(radtheta);
        if (dist > 1) {
            dist = 1;
        }
        dist = Math.acos(dist);
        dist = dist * 180 / Math.PI;
        dist = dist * 60 * 1.1515 * 1.609344;
        return dist;
    }
};

//Calculate distance between 2 cooridnates using google api.
module.exports.getPlacesDistance = async(fromLat, fromLong, toLat, toLong) => {
    let link = `https://maps.googleapis.com/maps/api/distancematrix/json?units=metric&origins=${fromLat},${fromLong}&destinations=${toLat},${toLong}&key=${process.env.GOOGLE_API}`;
    console.log("Link: ",JSON.stringify(link));
    let data = await axios.get(link);
    data = data.data;
    let output = {
        distance: data.rows[0].elements[0].distance || { text: "0 km", value: 0 },
        duration: data.rows[0].elements[0].duration || { text: "0 min", value: 0 }
    };
    console.log("Output: ",output);
    return output;
};