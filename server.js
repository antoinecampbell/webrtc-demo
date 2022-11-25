const express = require('express');
const expressWs = require("express-ws");

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
  console.log('Connection established');
  const uid = req.query.uid;
  connections[uid] = {uid, ws, candidates: []};
  ws.send(JSON.stringify({action: 'CONNECTED'}));
  broadcastUserList();

  ws.on('message', message => {
    console.log('Incoming message', message);
    const data = JSON.parse(message);
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
    console.log(`Connection closed for uid: ${uid}`);
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
  console.log(users);
  users.forEach(user => {
    connections[user.uid].ws.send(JSON.stringify({action: 'USER_LIST', users}));
  });
};

app.listen(port, () => {
  console.log(`Listening on port: ${port}`)
});
