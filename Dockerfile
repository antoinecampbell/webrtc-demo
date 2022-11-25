FROM node:16-alpine

EXPOSE 3000
WORKDIR /app
COPY package.json /app
COPY yarn.lock /app
COPY server.js /app
COPY public/ /app/public
RUN yarn

CMD node server.js
#Push to microk8s registry
#docker buildx build --platform linux/amd64,linux/arm64 --push -t home-server:32000/local/web-rtc-demo .
