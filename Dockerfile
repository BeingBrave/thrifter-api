FROM mhart/alpine-node:latest

RUN apk add --update alpine-sdk python

# use changes to package.json to force Docker not to use the cache
# when we change our application's nodejs dependencies:
ADD package.json /tmp/package.json
RUN cd /tmp && npm install --production
RUN mkdir -p /src && cp -a /tmp/node_modules /src/

# From here we load our application's code in, therefore the previous docker
# "layer" thats been cached will be used if possible
WORKDIR /src
ADD src /src
ADD package.json /src/package.json

ENV NODE_ENV production

VOLUME ["/src/data"]

EXPOSE 3030

CMD ["npm", "start"]