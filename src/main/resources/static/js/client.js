//connecting to our signaling server 
var conn = new WebSocket(`wss://${location.host}/socket`);

var peerConnection;
var dataChannel;
var input = document.getElementById("messageInput");
var incomingMessage = document.getElementById("incomingMessage");

var localVideo = document.querySelector('#localVideo');
var remoteVideo = document.querySelector('#remoteVideo');
var localStream;
var remoteStream;

var isInitiator = false;
var isStarted = false;


conn.onopen = function(e) {
    console.log("Connected to the signaling server : ", e);
};

/**
 * MessageEvent 객체가 인자로 전달된다.
 */
conn.onmessage = function({data}) {
    console.log("Got message : ", data);
    const _data = JSON.parse(data);
    const {type} = _data;
    switch (type) {
	case "create or join": 
		const {numOfClients} = _data;
		if(numOfClients == 1) {
			isInitiator = true; 
			console.log("isInitiator : ", isInitiator);
			initialize();	
		}
		else if (numOfClients == 2){
			if(!isStarted){
				console.log("isInitiator : ", isInitiator);
				initialize();
			}
			if(isInitiator)
				setTimeout(() => createOffer(), 2500);
		}
		else {
			alert("참여인원이 가득 찼습니다.");
		}
		break;		
	case "bye": 
		reset();
		break;		
    case "offer":
        handleOffer(_data); // for 2nd peer
        break;
    case "answer":
        handleAnswer(_data); // for initial peer
        break;
    // when a remote peer sends an ice candidate to us
    case "candidate":
        handleCandidate(_data);
        break;
    default:
        break;
    }
};

/**
 * 방에 남은 참여자는 initiator가 되서 다음 참여자를 기다린다.
 * https://stackoverflow.com/questions/25394151/how-can-i-reset-the-webrtc-state-in-chrome-node-webkit-without-refreshing-the-p
 */
function reset(){
	console.log("------ reset -------")
	if(isInitiator){
		//initialize();
		peerConnection.setRemoteDescription({type: "rollback"});
	}
	else {
		location.reload();
	}
	
}


function send(message) {
    conn.send(JSON.stringify(message));
}

function initialize() {
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
    peerConnection = new RTCPeerConnection(configuration);

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
	
    peerConnection.onremovestream = function(event){
		console.log('onremovestrem : ', event);
	}
	
	dataChannel = peerConnection.createDataChannel("dataChannel");
    onDataChannelCreated(dataChannel);
	
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
  	initLocalStream();
  	
  	isStarted = true;
  	
  	console.log("-----------initialize end------------------")
}

function initLocalStream(){
	
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
	navigator
		.mediaDevices
		.getUserMedia(constraints)
		.then(function(stream) {
		  console.log('Adding local stream.');
		  localStream = stream;
		  localVideo.srcObject = stream;
		  
		  // stream 추가
		  peerConnection.addStream(localStream);
		})
		.catch(function(e) {
		  alert('getUserMedia() error: ' + e.name);
		});
	
	

}

function createOffer() {
    peerConnection.createOffer(function(offer) {
        console.log("offer = ", offer);
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

function handleOffer(offer) {
	// 2nd peer의 상대 sdp 설정
    peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    // create and send an answer to an offer
    peerConnection.createAnswer(function(answer) {
		console.log("answer = ", answer);
        //2nd peer의 local sdp 설정
        peerConnection.setLocalDescription(answer);
        //answer 발송
        send(answer);
    }, function(error) {
        alert("Error creating an answer");
    });

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