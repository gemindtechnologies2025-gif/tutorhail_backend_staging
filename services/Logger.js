const Model = require("../models/index");

module.exports.checkLogs = async (req) => {
    let isAccess = false;
    let url = req.url.split("api/");
    let qry = {
        key: url[1]
    };
    let checkPermission = await Model.Settings.aggregate([{
        $match: {
            permission: {
                $elemMatch: qry
            }
        }
    }]);
    if (checkPermission.length > 0) {
        isAccess = true;
        return isAccess;
    }
    return isAccess;
};