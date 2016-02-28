#!/bin/bash

set -o pipefail

IMAGE="registry.ryanwelch.me/thrifter-api"
VERSION=$(cat package.json | grep '^.*version' | sed -s 's/[^0-9\.]//g')

build() {
	echo "Building version ${VERSION}"

	# Build docker image with server and assets
	docker build -t ${IMAGE}:${VERSION} . | tee build.log || exit 1
	ID=$(tail -1 build.log | awk '{print $3;}')
	docker tag -f $ID ${IMAGE}:latest
}

publish() {
	echo "Publishing version ${VERSION}"
	docker push ${IMAGE}:${VERSION}
	docker push ${IMAGE}:latest
}

cr=`echo $'\n.'`
cr=${cr%.}

if [[ "$(docker images ${IMAGE} | grep ${VERSION} 2> /dev/null)" == "" ]]; then
	build
else
	while true; do
	    read -p "Verion ${VERSION} already exists, are you sure you want to build?${cr}Please answer [y]es or [n]o: " yn
	    case $yn in
	        [Yy]* ) build;;
	        [Nn]* ) break;;
	        * ) echo "Please answer [y]es or [n]o.";;
	    esac
	done
fi

while true; do
    read -p "Do you want to publish version ${VERSION}?${cr}Please answer [y]es or [n]o: " yn
    case $yn in
        [Yy]* ) publish;;
        [Nn]* ) exit;;
        * ) echo "Please answer [y]es or [n]o.";;
    esac
done
