#FROM node:onbuild
FROM mhart/alpine-node:4.3.1

RUN apk add --no-cache make gcc g++ python

# use changes to package.json to force Docker not to use the cache
# when we change our application's nodejs dependencies:
ADD package.json /tmp/package.json
RUN cd /tmp && npm install --production
RUN mkdir -p /src && cp -a /tmp/node_modules /src/

# From here we load our application's code in, therefore the previous docker
# "layer" thats been cached will be used if possible
WORKDIR /src
ADD . /src

ENV NODE_ENV production

VOLUME ["/src/data"]

EXPOSE 3333

CMD ["npm", "start"]
