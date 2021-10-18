#!/bin/bash

if [ ! -z "$USER_ID" ]
then
	usermod -u $USER_ID node
	echo "Changing user id to $USER_ID"
fi

if [ ! -z "$GROUP_ID" ]
then
	groupmod -g $GROUP_ID node
	echo "Changing group id to $GROUP_ID"
fi

if [ ! -d "/db" ]
then
	echo "No /db directory, scanned data will be lost with the container."
	mkdir /db
	chown node:node /db
fi

runuser -u node -g node node server
	
