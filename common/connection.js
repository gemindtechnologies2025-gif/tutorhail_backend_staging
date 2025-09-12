const mongoose = require("mongoose");
global.ObjectId = mongoose.Types.ObjectId;

//Mongo Db connection
module.exports.mongodb = async () => {
    await mongoose.connect(
        process.env.MONGODB_URL, {
            useUnifiedTopology: true,
            useFindAndModify: false,
            useNewUrlParser: true,
            useCreateIndex: true
        },
        (error, result) => {
            if (result) {
                console.log("Mongo Connected to", process.env.MONGODB_URL);
            } else {
                console.error("Mongo", error);
            }
        }
    );
};