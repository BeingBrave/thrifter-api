const Joi = require('joi');
const ObjectAssign = require('object-assign');
const BaseModel = require('hapi-mongo-models').BaseModel;

const User = BaseModel.extend({
    // instance prototype
    constructor: function (attrs) {

        ObjectAssign(this, attrs);
    }
});

User._collection = 'users';

User.schema = Joi.object().keys({
    username: Joi.string().alphanum().required(),
    name: Joi.string().alphanum().required(),
    email: Joi.string().email().required(),
    facebookId: [Joi.string(), Joi.number()],
    access_token: [Joi.string(), Joi.number()]
})

module.exports = User;
