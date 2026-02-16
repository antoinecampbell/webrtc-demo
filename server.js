const express = require('express');
const expressWs = require("express-ws");
const pino = require('pino');

// Initialize logger - pretty for local dev, JSON for production
const useJsonLogs = process.env.NODE_ENV !== undefined;
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => {
      return { level: label };
    }
  },
  transport: !useJsonLogs ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname'
    }
  } : undefined
});

// Constants and variables
const port = process.env.PORT || 3000;
const connections = {};

// Create express app, serve static content
const app = express();
app.use(express.static('public'));

// Enable websocket middle ware
expressWs(app);

// Endpoint to broadcast messages to all users, maybe for a chat feature
app.get('/broadcast', (req, res) => {
  const message = req.query.message;
  Object.keys(connections).forEach(key => {
    connections[key].ws.send(JSON.stringify({action: 'BROADCAST', message}));
  });
  res.send(message);
});

// Websocket routes
app.ws('/ws', (ws, req) => {
  const uid = req.query.uid;
  logger.info({ uid, event: 'connection_established' }, 'Connection established');
  connections[uid] = {uid, ws, candidates: []};
  ws.send(JSON.stringify({action: 'CONNECTED'}));
  broadcastUserList();

  ws.on('message', message => {
    const data = JSON.parse(message);
    logger.info({ uid, action: data.action, event: 'incoming_message' }, 'Incoming message');
    switch (data.action) {
      case 'OFFER':
        // TODO handle peer specific offer
        connections[uid].offer = data.offer;
        broadcastUserList();
        break;
      case 'ANSWER':
        // TODO handle peer specific answer
        connections[uid].answer = data.answer;
        broadcastUserList();
        break;
      case 'ICE_CANDIDATE':
        connections[uid].candidates.push(data.candidate);
        broadcastUserList();
        break;
    }
  });

  ws.on('close', () => {
    logger.info({ uid, event: 'connection_closed' }, 'Connection closed');
    delete connections[uid];
    broadcastUserList();
  });
});

const broadcastUserList = () => {
  const users = Object.keys(connections).map(key => {
    return {
      uid: key,
      offer: connections[key].offer,
      answer: connections[key].answer,
      candidates: connections[key].candidates
    }
  });
  logger.debug({ userCount: users.length, event: 'broadcast_user_list' }, 'Broadcasting user list');
  users.forEach(user => {
    connections[user.uid].ws.send(JSON.stringify({action: 'USER_LIST', users}));
  });
};

app.listen(port, () => {
  logger.info({ port, event: 'server_started' }, 'Server started');
});
