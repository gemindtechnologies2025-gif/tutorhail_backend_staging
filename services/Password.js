const bcrypt = require("bcryptjs");
const Model = require("../models/index");
const constants = require("../common/constants");

//Set password using bcrypt.
module.exports.setPassword = async function (password, type, id) {
    let hashPwd = await bcrypt.hash(password, 10);
    if (type == constants.ROLE.USER) {
        await Model.User.findOneAndUpdate({
            _id : id
        },{
            $set: {
                password : hashPwd
            }
        },{
            new : true
        });
    }else if (type == constants.ROLE.ADMIN) {
        await Model.Admin.findOneAndUpdate({
            _id : id
        },{
            $set: {
                password : hashPwd
            }
        },{
            new : true
        });
    }
    return this;
  };
