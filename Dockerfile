FROM node:16-alpine

EXPOSE 3000
WORKDIR /app
COPY package.json /app
COPY yarn.lock /app
COPY server.js /app
COPY public/ /app/public
RUN yarn

CMD node server.js
