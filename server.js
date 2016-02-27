const Hapi = require('hapi');
const Boom = require('boom');
const AuthBearer = require('hapi-auth-bearer-token');
const HapiMongoModels = require('hapi-mongo-models');
const Uuid = require('node-uuid');
const Request = require('request');
const dhash = require('dhash');
const fs = require('fs');

const server = new Hapi.Server();
server.connection({ port: 3333 });

server.register({
    register: HapiMongoModels,
    options: {
        mongodb: {
          url: 'mongodb://localhost:27017/test',
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

            //Request('https://graph.facebook.com/me?access_token=' + token, function (error, response, body) {
                //console.log(response);
                //console.log(body);
                //if (!error && response.statusCode == 200) {
                    //var profile = JSON.parse(body);
                    var profile = {};

                    return callback(null, true, {
                        username: profile.username || "hi",
                        name: profile.name || "hi",
                        email: profile.email || "hi@hi",
                        token: token
                    });
                //} else {
                //    return callback(null, false, { token: token });
                //}
            //});
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
                if (err) {
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
                if (!err) {
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
                        console.log(result);

                        return reply(result);
                    });

                } else {
                    console.log(err);
                    return reply(err);
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

            try {
                User.findOne({
                    access_token: request.auth.credentials.token
                }, (err, result) => {
                    if (err) {
                        return reply(err);
                    }

                    return reply(result);
                });

            } catch(err) {
                return reply('fail api');
            }
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

            try {
                Item.findOne({
                    uuid: request.query.id
                }, (err, result) => {
                    if (err) {
                        return reply(err);
                    }

                    return reply(result);
                });

            } catch(err) {
                return reply('fail api');
            }
        }
    }
});

/**
*   POST: name, file
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
                //var name = data.file.hapi.filename; // TODO: Fix this
                var name = Uuid.v4();
                var path = __dirname + "/data/" + name;
                var file = fs.createWriteStream(path);

                file.on('error', function (err) {
                    console.error(err)
                });

                data.file.pipe(file);

                data.file.on('end', function (err) {
                    //dhash(path, function(err, hash){
                        Item.insertOne({
                            uuid: Uuid.v4(),
                            name: data.name,
                            imageHash: name,
                            owner: request.auth.credentials.uuid,
                        }, (err, result) => {
                            if (err) {
                                return reply(err);
                            }

                            return reply(result);
                        });


                    //});
                })
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
            var path = __dirname + "/data/" + request.query.hash;
            reply.file(path);
        }
    }
});


server.start((err) => {
    if (err) {
      throw err;
    }
    console.log('Server started at: ' + server.info.uri);
})
