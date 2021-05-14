//connecting to our signaling server 
var conn = new WebSocket(`wss://${location.host}/socket`);

var peerConnection;
var dataChannel;
var input = document.getElementById("messageInput");
var incomingMessage = document.getElementById("incomingMessage");

var localVideo = document.querySelector('#localVideo');
var remoteVideo = document.querySelector('#remoteVideo');

conn.onopen = function(e) {
    console.log("Connected to the signaling server : ", e);
    initialize();
};

/**
 * MessageEvent 객체가 인자로 전달된다.
 */
conn.onmessage = function({data}) {
    console.log("Got message : ", data);
    const _data = JSON.parse(data);
    const {type} = _data;
    switch (type) {
    // when somebody wants to call us
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

function send(message) {
    conn.send(JSON.stringify(message));
}

function initialize() {
	/**
	 * STUN (Session Traversal Utilities for NAT) servers
	 * TURN (Traversal Using Relays around NAT) servers
	 * other configurations 
	 */ 
    var configuration = null;

    peerConnection = new RTCPeerConnection(configuration);

    // Setup ice handling
    peerConnection.onicecandidate = function(event) {
        const {candidate} = event; 
        console.log("candidate = ", candidate);
        if (candidate) {
            send(candidate);
        }
    };
  	
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
  	
  	
  	// creating data channel
    dataChannel = peerConnection.createDataChannel("dataChannel");
    onDataChannelCreated(dataChannel);
  	
  	
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
        const {data} = event;
        const p = document.createElement("p");
        p.append(data);
        incomingMessage.append(p);
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
	//console.log("handleCandidate = ", candidate);
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