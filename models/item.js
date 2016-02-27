const Joi = require('joi');
const ObjectAssign = require('object-assign');
const BaseModel = require('hapi-mongo-models').BaseModel;

const Item = BaseModel.extend({
    // instance prototype
    constructor: function (attrs) {

        ObjectAssign(this, attrs);
    }
});

Item._collection = 'items';

Item.schema = Joi.object().keys({
	uuid: Joi.string(),
    imageHash: Joi.string().alphanum().required(),
    name: Joi.string().alphanum().required(),
    owner: Joi.string()
})

module.exports = Item;
