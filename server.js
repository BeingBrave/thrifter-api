const Hapi = require('hapi');
const Boom = require('boom');
const AuthBearer = require('hapi-auth-bearer-token');
const HapiMongoModels = require('hapi-mongo-models');
const Inert = require('inert');
const Uuid = require('node-uuid');
const Request = require('request');
const dhash = require('dhash');
const fs = require('fs');

const server = new Hapi.Server();
server.connection({ host: "0.0.0.0", port: 3333 });

server.register(Inert, () => {});

server.register({
    register: HapiMongoModels,
    options: {
        mongodb: {
          url: process.env.DB ? process.env.DB : 'mongodb://mongodb:27017/thrifter',
          options: {}
        },
        autoIndex: false,
        models: {
            User: './models/user.js',
            Item: './models/item.js'
        }
    }
}, (err) => {
     if (err) {
         console.log('Failed connecting to database');
     }
});

server.register(AuthBearer, (err) => {
    server.auth.strategy('facebook_auth', 'bearer-access-token', {
        allowQueryToken: true,              // optional, true by default
        allowMultipleHeaders: false,        // optional, false by default
        accessTokenName: 'access_token',    // optional, 'access_token' by default
        validateFunc: function (token, callback) {
            // For convenience, the request object can be accessed
            // from `this` within validateFunc.
            var request = this;
            const User = request.server.plugins['hapi-mongo-models'].User;

            Request('https://graph.facebook.com/me?access_token=' + token, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    var profile = JSON.parse(body);

                    return callback(null, true, {
                        username: profile.username,
                        name: profile.name,
                        email: profile.email,
                        token: token
                    });
                } else {
                   return callback(null, false, { token: token });
                }
            });
        }
    });

    server.auth.strategy('api_auth', 'bearer-access-token', {
        allowQueryToken: true,              // optional, true by default
        allowMultipleHeaders: false,        // optional, false by default
        accessTokenName: 'access_token',    // optional, 'access_token' by default
        validateFunc: function (token, callback) {
            var request = this;

            const User = request.server.plugins['hapi-mongo-models'].User;

            User.findOne({
                access_token: token
            }, (err, result) => {
                if (err || !result) {
                    return callback(null, false, { token: token });
                }

                return callback(null, true, {
                    uuid: result.uuid,
                    username: result.username,
                    name: result.name,
                    email: result.email,
                    access_token: result.access_token,
                    token: token
                });
            });
        }
    });
});

server.route({
    method: 'GET',
    path: '/auth/facebook',
    config: {
       auth: 'facebook_auth',
       handler: function (request, reply) {
            const User = request.server.plugins['hapi-mongo-models'].User;

            User.findOne({
                facebookId: request.auth.credentials.token
            }, (err, result) => {
                if (err) {
                    User.insertOne({
                        uuid: Uuid.v4(),
                        username: request.auth.credentials.username,
                        name: request.auth.credentials.name,
                        email: request.auth.credentials.email,
                        facebookId: request.auth.credentials.token,
                        access_token: Uuid.v4().replace(/-/g, "")
                    }, (err, result) => {
                        if (err) {
                            return reply(err);
                        }

                        return reply({
                            data: result
                        });
                    });

                } else {

                    return reply({
                        data: result
                    });
                }

            });
       }
    }
});

server.route({
    method: 'GET',
    path: '/user',
    config: {
       auth: 'api_auth',
       handler: function (request, reply) {
            const User = request.server.plugins['hapi-mongo-models'].User;

            User.findOne({
                access_token: request.auth.credentials.token
            }, (err, result) => {
                if (err) {
                    return reply(Boom.badRequest("Could not get user"));
                }

                return reply({
                    data: result
                });
            });
        }
    }
});

server.route({
    method: 'GET',
    path: '/item/{id}',
    config: {
        auth: 'api_auth',
        handler: function (request, reply) {
            const Item = request.server.plugins['hapi-mongo-models'].Item;

            Item.findOne({
                uuid: request.query.id
            }, (err, result) => {
                if (err) {
                    return reply(Boom.badRequest("Could not get item"));
                }

                return reply({
                    data: result
                });
            });
        }
    }
});

/**
*   POST: name, file, lat, lon
*
*/
server.route({
    method: 'POST',
    path: '/item',
    config: {
        auth: 'api_auth',

        payload: {
            output: 'stream',
            parse: true,
            allow: 'multipart/form-data'
        },

        handler: function (request, reply) {
            const Item = request.server.plugins['hapi-mongo-models'].Item;

            var data = request.payload;

            if (data.file) {
                var name = Uuid.v4();
                var path = __dirname + "/data/" + name;
                var file = fs.createWriteStream(path);

                file.on('error', function (err) {
                    console.log(err);
                    return reply(Boom.badRequest("Could not upload"));
                });

                data.file.pipe(file);

                data.file.on('end', function (err) {
                    Item.insertOne({
                        uuid: Uuid.v4(),
                        name: data.name,
                        loc: {
                            type: "Point",
                            coordinates: [ parseFloat(data.lat), parseFloat(data.lon) ]
                        },
                        imageHash: name,
                        owner: request.auth.credentials.uuid,
                    }, (err, result) => {
                        if (err) {
                            return reply(Boom.badRequest("Could not upload"));
                        }

                        return reply({
                            data: result
                        });
                    });
                })
            } else {
                return reply(Boom.badRequest("Invalid parameters"));
            }
        }
    }
});

server.route({
    method: 'GET',
    path: '/static/{hash}',
    config: {
        auth: 'api_auth',
        handler: function (request, reply) {
            var path = "data/" + request.params.hash;
            reply.file(path);
        }
    }
});

server.route({
    method: 'GET',
    path: '/search',
    config: {
        auth: 'api_auth',
        handler: function (request, reply) {
            const Item = request.server.plugins['hapi-mongo-models'].Item;

            // TODO: Fix this
            Item.createIndexes([{ key: { "loc": "2dsphere" } }], (err, result) => {
                if (err) {
                    console.log(err);
                }
            });


            Item.find({
                loc: {
                    $near: {
                        $geometry: {
                          type: 'Point',
                          coordinates: [parseFloat(request.query.lat), parseFloat(request.query.lon)]
                        },
                        $maxDistance: parseInt(request.query.distance ? request.query.distance : 100) / 6371
                    }
                }
            }, (err, result) => {
                if (err) {
                    return reply(Boom.badRequest("Could not get search"));
                }

                return reply({
                    data: result
                });
            });
        }
    }
});

server.start((err) => {
    if (err) {
      throw err;
    }
    console.log('Server started at: ' + server.info.uri);
})
