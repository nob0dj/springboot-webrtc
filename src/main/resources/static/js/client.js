//connecting to our signaling server 
//var conn = new WebSocket(`wss://${location.host}/socket`);
var conn = new SockJS(`https://${location.host}/socket`); // sock.js

var peerConnection;
var dataChannel;
var input = document.getElementById("messageInput");
var incomingMessage = document.getElementById("incomingMessage");

var localVideo = document.querySelector('#localVideo');
var remoteVideo = document.querySelector('#remoteVideo');
var localStream;
var remoteStream;

var isInitiator = false;
var isStarted = false; // initialize호출후 true로 변경

conn.onopen = function(e) {
    console.log("Connected to the signaling server : ", e);
};

/**r
 * MessageEvent 객체가 인자로 전달된다.
 */
conn.onmessage = function({data}) {
	data = JSON.parse(data);
    console.log("Got message : ", data);
    const {type, numOfClients} = data;
	
	if(type != 'candidate') alert("message.type = " + type);
	
    switch (type) {
	case "create or join": 
		if(numOfClients == 1) {
			isInitiator = true; 
			console.log("isInitiator : ", isInitiator);
			initialize();	
		}
		else if (numOfClients == 2){
			if(!isStarted && !isInitiator){
				console.log("isInitiator : ", isInitiator);
				initialize();
			}
		}
		break;
	case "full":
		alert("참여인원이 가득 찼습니다.");
		break;
			
	case "bye": 
		reset();
		break;		
	case "joined": 
		createOffer();  // initiator이 경우만 "joined" message를 받는다. offer생성/전송
		break;		
    case "offer":
        handleOffer(data); // for 2nd peer
        break;
    case "answer":
        handleAnswer(data); // for initial peer
        break;
    // when a remote peer sends an ice candidate to us
    case "candidate":
        handleCandidate(data);
        break;
    default:
        break;
    }
};

window.onbeforeunload = function() {
  //send({type: "bye"});
};

/**
 * 방에 남은 참여자는 initiator가 되서 다음 참여자를 기다린다.
 * https://stackoverflow.com/questions/25394151/how-can-i-reset-the-webrtc-state-in-chrome-node-webkit-without-refreshing-the-p
 */
function reset(){
	console.log("<<<<< reset >>>>>")
	if(isInitiator){
		/**
		 * Uncaught (in promise) DOMException: Failed to execute 'setRemoteDescription' on 'RTCPeerConnection': Called in wrong signalingState: stable
		 * 아래 코드를 작성하지 않아도 2nd peer join이벤트가 발생하면 이전 정보는 overwrite 된다. 
		 */
		//peerConnection.setRemoteDescription({type: "rollback"}); // remote rtcPeerConnection정보를 초기화 한다.
	}
	else {
		setTimeout(() => location.reload(), 100); // initiator가 아닌 경우 페이지 새로고침을 통해 initiator가 된다.
	}
	
}


function send(message) {
    conn.send(JSON.stringify(message));
}

async function initialize() {
	/**
	 * STUN (Session Traversal Utilities for NAT) servers
	 * TURN (Traversal Using Relays around NAT) servers
	 * other configurations 
	 */ 
    var configuration = {
	  'iceServers': [
	    {
	      'urls': 'stun:stun.l.google.com:19302'
	    },
	    {
	      urls: "turn:numb.viagenie.ca",
	      credential: "muazkh",
	      username: "webrtc@live.com"
	    }
	  ]
	};
    peerConnection = new RTCPeerConnection();
	peerConnection.setConfiguration(configuration);
    console.log("peerConnection생성 : ", peerConnection);
    
    // Setup ice handling
    peerConnection.onicecandidate = function(event) {
        const {candidate: obj} = event; 
        console.log("candidate = ", obj); // RTCIceCandidate객체
        
        if (obj) {
			const {candidate, sdpMLineIndex, sdpMid} = obj;
            send({
				type: "candidate",
				candidate,
		      	sdpMLineIndex,
		      	sdpMid
			});
        }
    };
    
    peerConnection.onaddstream = function(event){
		console.log("onaddstream = ", event);
		remoteStream = event.stream;
		remoteVideo.srcObject = remoteStream;
	}

    peerConnection.ontrack = function(event){
		alert("ontrack = " + JSON.stringify(event));
		console.log("ontrack = ", event);
		//remoteStream = event.streams[0];
		remoteVideo.srcObject = event.streams[0];
	}
	
    peerConnection.onremovestream = function(event){
		console.log('onremovestrem : ', event);
	}
	
    if(isInitiator){    	
    	dataChannel = await peerConnection.createDataChannel("dataChannel");
    	console.log("createDateaChannel : ", dataChannel);
    	onDataChannelCreated(dataChannel);
    }
	
  	/**
  	 * datachannel에서 message를 받기위해서
  	 * peerConnection객체의 datachannel이벤트핸들러를 작성해야 한다.
  	 * 
  	 * peerConnection객체에 datachannel이 추가될때 발생.
  	 * local에서 peerConnection.createDataChannel호출시는 발생되지 않음.
  	 */
  	peerConnection.ondatachannel = function (event) {
		console.log("ondatachannel = ", event);
        dataChannel = event.channel;
        onDataChannelCreated(dataChannel);
  	};
  	
  	//localStream
  	await initLocalStream();
  	
  	isStarted = true;
  	
  	console.log("<<<<< initialize end >>>>>");
  	send({
		type: isInitiator ? "created" : "joined"
	});
}


async function initLocalStream(){
	
	localVideo.addEventListener('click', e => {
	  mute(localVideo);
	});
	
	/**
	 * video/audio를 잠시 멈춤
	 * @param {HTMLObject} videoElem 
	 */
	const mute = videoElem => {
	  const {srcObject: stream} = videoElem;
	  const tracks = stream.getTracks();
	  tracks.forEach(track => track.enabled = !track.enabled); 
	};
	
	const constraints = {
	    video: true,
	    audio : true
	};
	
	await 
	navigator
		.mediaDevices
		.getUserMedia(constraints)
		.then(function(stream) {
		  localStream = stream;
		  localVideo.srcObject = stream;
		  
		  console.log('Adding local stream.');		  
		  if(peerConnection.addStream){
			// stream 추가
		  	peerConnection.addStream(localStream); // add stream deprecated
		  }
		  else{
		    localStream.getTracks().forEach(track => {
			  peerConnection.addTrack(track, stream);
		    });			
		  }
		  alert('Adding local stream complete!');
		})
		.catch(function(e) {
		  alert('getUserMedia() error: ' + e.name);
		});

	console.log("<<<<< initLocalStream end >>>>>");
}

function createOffer() {
    peerConnection.createOffer(function(offer) {
        console.log("createOffer = ", offer);
        send(offer);
        // initial peer의 local sdp 설정
        peerConnection.setLocalDescription(offer);
    }, function(error) {
        alert("Error creating an offer");
    });
}

function onDataChannelCreated(dataChannel){
	dataChannel.onerror = function(error) {
        console.log("Error occured on datachannel:", error);
    };

    // when we receive a message from the other peer, printing it on the console
    dataChannel.onmessage = function(event) {
        console.log("message:", event.data);
        //기존 자식 요소제거
        incomingMessage.firstChild && incomingMessage.removeChild(incomingMessage.firstChild);
        
        const {data} = event;
        const p = document.createElement("p");
        const txt = document.createTextNode(data);
        p.appendChild(txt);
        incomingMessage.appendChild(p);
    };
    
    dataChannel.onclose = function() {
        console.log("data channel is closed");
    };
}

async function handleOffer(offer) {
	alert("handleOffer start");
	// 2nd peer의 상대 sdp 설정
    peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    // create and send an answer to an offer
    await
	peerConnection.createAnswer(function(answer) {
		alert("answer = " + answer);
		console.log("answer = ", answer);
        //2nd peer의 local sdp 설정
        peerConnection.setLocalDescription(answer);
        //answer 발송
        send(answer);
    }, function(error) {
        alert("Error creating an answer");
    });
	alert("handleOffer end");
};

/**
* candidate객체를 candidate pool에 추가
*/
function handleCandidate(candidate) {
	console.log("handleCandidate = ", candidate);
    peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
};

function handleAnswer(answer) {
    peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    console.log("connection established successfully!!");
};

function sendMessage() {
    dataChannel.send(input.value);
    input.value = "";
}