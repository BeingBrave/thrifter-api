const Hapi = require('hapi');
const Boom = require('boom');
const AuthBearer = require('hapi-auth-bearer-token');

const server = new Hapi.Server();
server.connection({ port: 3333 });

const dbOpts = {
    "url": "mongodb://localhost:27017/test",
    "settings": {
        "db": {
            "native_parser": false
        }
    }
};

server.register({
    register: require('hapi-mongodb'),
    options: dbOpts
}, (err) => {
    if (err) {
        console.error(err);
        throw err;
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

            // Use a real strategy here,
            // comparing with a token from your database for example
            if (token === "1234") {
                return callback(null, true, { token: token });
            }

            return callback(null, false, { token: token });
        }
    });

    server.auth.strategy('api_auth', 'bearer-access-token', {
        allowQueryToken: true,              // optional, true by default
        allowMultipleHeaders: false,        // optional, false by default
        accessTokenName: 'access_token',    // optional, 'access_token' by default
        validateFunc: function (token, callback) {

            // For convenience, the request object can be accessed
            // from `this` within validateFunc.
            var request = this;

            // Use a real strategy here,
            // comparing with a token from your database for example
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
          return reply('success');
       }
    }
});

server.route({
    method: 'GET',
    path: '/',
    config: {
       auth: 'api_auth',
       handler: function (request, reply) {
          return reply('success api');
       }
    }
});

server.route({
    method: 'GET',
    path: '/item/{id}',
    config: {
        auth: 'api_auth',
        handler: function (request, reply) {
            var db = request.server.plugins['hapi-mongodb'].db;
            var ObjectID = request.server.plugins['hapi-mongodb'].ObjectID;

            db.collection('items').findOne({  "_id" : new ObjectID(request.params.id) }, function(err, result) {
                if (err) return reply(Boom.internal('Internal MongoDB error', err));
                reply(result);
            });
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
