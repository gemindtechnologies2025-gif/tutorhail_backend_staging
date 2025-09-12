const constants = require("../common/constants");
const Model = require("../models/index");

module.exports.checkSubAdmin = async (req) => {
    let isAccess = false;
    if (req.admin.role == constants.ROLE.SUBADMIN) {
        let qry = {
            label: req.body.label
        };
        if (req.body.apiType == "get") {
            qry.isView = true;
        } else {
            qry.isView = true;
            if (req.body.apiType == "delete") {
                qry.isDelete = true;
            }
            if (req.body.apiType == "add") {
                qry.isAdd = true;
            }
        }
        let checkPermission = await Model.Admin.aggregate([{
            $match: {
                _id: req.admin._id,
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

    } else if (req.admin.role == constants.ROLE.ADMIN) {
        isAccess = true;
        return isAccess;
    }
};