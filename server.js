const Hapi = require('hapi');
const Boom = require('boom');
const AuthBearer = require('hapi-auth-bearer-token');
const HapiMongoModels = require('hapi-mongo-models');
const Request = require('request');

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
            User: './models/user.js'
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
                console.log(response);
                console.log(body);
                if (!error && response.statusCode == 200) {
                    var profile = JSON.parse(body);

                    return callback(null, true, {
                        username: profile.username,
                        name: profile.name,
                        email: profile.email,
                        token: token
                    });
                } else {
                    return callback(null, false, null);
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


            // Get user for token if token exists
            if (token === "4321") {
                return callback(null, true, { token: token });
            }

            return callback(null, false, { token: token });
        }
    });
});

server.route({
    method: 'GET',
    path: '/auth/facebook',
    config: {
       auth: 'facebook_auth',
       handler: function (request, reply) {
            try {
                User.insertOne({
                    username: request.auth.credentials.username,
                    name: request.auth.credentials.name,
                    email: request.auth.credentials.email,
                    facebookId: request.auth.credentials.token,
                    access_token: "4321"
                }, (err, result) => {
                    if (err) {
                        return reply(err);
                    }

                    return reply('success api');
                });

            } catch(err) {
                return reply('fail api');
            }
       }
    }
});

server.route({
    method: 'GET',
    path: '/user',
    config: {
       auth: 'api_auth',
       handler: function (request, reply) {
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
    path: '/user/{id}',
    config: {
        auth: 'api_auth',
        handler: function (request, reply) {
            const User = request.server.plugins['hapi-mongo-models'].User;

            User.findOne({access_token: request.query.access_token}, (err, results) => {
                if (err) {
                    return reply(err);
                }

                reply(results);
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

        }
    }
});

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
            var data = request.payload;
            if (data.file) {
                var name = data.file.hapi.filename;
                var path = __dirname + "/data/" + name;
                var file = fs.createWriteStream(path);

                file.on('error', function (err) {
                    console.error(err)
                });

                data.file.pipe(file);

                data.file.on('end', function (err) {
                    reply(JSON.stringify({
                        "status": "okay"
                    }));
                })
            }

        }
    }
});


server.start((err) => {
    if (err) {
      throw err;
    }
    console.log('Server started at: ' + server.info.uri);
})
