const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const Model = require('../models/index');
const utility = require("../common/functions");

module.exports.pagination = async (pipeline, skip, limit) => {
    pipeline.push({
        $facet: {
            metadata: [{
                $group: {
                    _id: null,
                    total: {
                        $sum: 1
                    }
                }
            }],
            data: [
                //{ $sort: sort },
                {
                    $skip: skip
                },
                {
                    $limit: limit
                }
            ]
        }
    }, {
        $project: {
            total: {
                $arrayElemAt: ['$metadata.total', 0]
            },
            data: 1
        }
    });
    return pipeline;
};

module.exports.findUniqueConnectId = async (parentId, tutorId) => {
  const query = {
    $or: [
      { parentId: ObjectId(parentId), tutorId: ObjectId(tutorId) },
      { parentId: ObjectId(tutorId), tutorId: ObjectId(parentId) }
    ]
  };
  
  let chat = await Model.ChatMessage.findOne(query);
  if (!chat) {
    const data = {
      parentId: ObjectId(parentId),
      tutorId: ObjectId(tutorId),
      connectionId: utility.generateNumber(12),
      message: null
    };
    chat = await Model.ChatMessage.create(data);
  }
  return chat.connectionId;
};
