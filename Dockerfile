FROM node:latest

EXPOSE 3000

copy ./src /src/


WORKDIR /src/

RUN npm install

CMD /src/start.sh
