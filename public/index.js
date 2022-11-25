let localStream;
let remoteStream;
let peerConnection;
// Generate random id to identify this session
const uid = Math.floor(Math.random() * 10000).toString();

const constraints = {
  video: {
    // width: {min: 640, ideal: 1920, max: 1920},
    // height: {min: 480, ideal: 1080, max: 1080},
    width: {min: 640, ideal: 640, max: 640},
    height: {min: 480, ideal: 480, max: 480}
  },
  audio: true
};

// Google STUN servers - for dev purposes
const servers = {
  iceServers: [{
    urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302']
  }]
};
// Establish websocket connection
const webSocketProtocol = location.protocol === 'https:' ? 'wss' : 'ws';
const webSocket = new WebSocket(`${webSocketProtocol}://${location.host}/ws?uid=${uid}`);
// Websocket event handlers
webSocket.onopen = () => console.log("Websocket connected");
webSocket.onclose = () => console.log("Websocket disconnected");
webSocket.onmessage = event => {
  const message = JSON.parse(event.data);
  const action = message.action;
  console.log('Incoming message', message);

  switch (action) {
    case 'USER_LIST':
      const userList = message.users.filter(data => data.uid !== uid)
        .map(data => {
          const anchorElement = document.createElement('a');
          anchorElement.href = '#';
          const userId = uid === data.uid ? 'Me' : data.uid;
          anchorElement.classList.add('list-group-item', 'list-group-action');
          if (data.offer) {
            anchorElement.innerHTML = `Answer: ${userId}`;
            anchorElement.classList.add('list-group-item-primary')
            anchorElement.onclick = async () => {
              await createPeerAnswer(data);
            };
          } else if (data.answer) {
            anchorElement.innerHTML = `Add candidate: ${userId}`;
            anchorElement.classList.add('list-group-item-success');
            anchorElement.onclick = async () => {
              await addCandidate(data);
            };
          } else {
            anchorElement.innerHTML = `Offer: ${userId}`;
            anchorElement.classList.add('list-group-item-secondary')
            anchorElement.onclick = async () => {
              await createPeerOffer(data);
            };
          }
          return anchorElement;
        });
      const userListElement = document.getElementById('user-list')
      userListElement.innerHTML = '';
      userList.forEach(element => userListElement.appendChild(element));
      break;
  }
};


// Toggle video
async function toggleVideo() {
  if (localStream && localStream.active) {
    localStream.getTracks().forEach(track => {
      track.stop();
    });
    localStream = undefined;
    document.getElementById('self-video').srcObject = undefined;
  } else {
    localStream = await navigator.mediaDevices.getUserMedia(constraints)
    document.getElementById('self-video').srcObject = localStream;
    await createPeerConnection();
  }
}

document.getElementById('self-video-toggle')
  .addEventListener('click', toggleVideo);

async function createPeerConnection() {
  peerConnection = new RTCPeerConnection(servers);
  console.log('Peer Connection', peerConnection);
  remoteStream = new MediaStream();
  document.getElementById('remote-video').srcObject = remoteStream;

  if (localStream) {
    console.log('Adding local stream to peer connection');
    localStream.getTracks().forEach((track) => {
      console.log('Added track', track);
      peerConnection.addTrack(track, localStream)
    });
  }

  peerConnection.ontrack = event => {
    console.log('Track', event);
    event.streams[0].getTracks().forEach(track => {
      console.log('Adding track to remote stream', track);
      remoteStream.addTrack(track);
    });
  };

  peerConnection.onicecandidate = async event => {
    if (event.candidate) {
      webSocket.send(JSON.stringify({
        action: 'ICE_CANDIDATE',
        uid,
        candidate: event.candidate
      }));
      console.log('ICE candidate', JSON.stringify(event.candidate));
    }
  }
}

async function createPeerOffer(data) {
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  const message = {action: 'OFFER', uid, offer, peerUid: data.uid};
  webSocket.send(JSON.stringify(message))
}

async function createPeerAnswer(data) {
  const offer = data.offer;
  await peerConnection.setRemoteDescription(offer);
  let answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  webSocket.send(JSON.stringify({
    action: 'ANSWER',
    peerUid: uid,
    answer
  }));
}

async function addCandidate(data) {
  await peerConnection.setRemoteDescription(data.answer);
  await peerConnection.addIceCandidate(data.candidates[0]);
}
