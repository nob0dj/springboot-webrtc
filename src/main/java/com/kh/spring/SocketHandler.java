package com.kh.spring;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import com.google.gson.Gson;

/**
 * client간 직접 RTC Connection을 맺을 수 있도록 서로의 metadata를 주고받는다.
 */
@Component
public class SocketHandler extends TextWebSocketHandler {

	List<WebSocketSession> sessions = new CopyOnWriteArrayList<>();
	private static final String CREATE_OR_JOIN = "create or join";
	private static final String BYE = "bye";
    

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        sessions.add(session);
        
        sendMessage(session, CREATE_OR_JOIN);
    }
    @Override
	public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
    	sessions.remove(session);
    	sendMessage(session, BYE);
	}

	@Override
    public void handleTextMessage(WebSocketSession session, TextMessage message) throws InterruptedException, IOException {
		String type = getType(message);
		boolean forEveryone = CREATE_OR_JOIN.equals(type) || BYE.equals(type);
        for (WebSocketSession sess : sessions) {
        	
        	/**
        	 * 메세지를 발행한 session을 제외하고 전송
        	 */
            if (forEveryone || sess.isOpen() && !session.getId().equals(sess.getId())) {
                sess.sendMessage(message);
            }
        }
    }
	
	private String getType(TextMessage message) {
		String _payload = message.getPayload();
		Map<String, Object> payload = new Gson().fromJson(_payload, HashMap.class);
		return String.valueOf(payload.get("type"));
	}
	private void sendMessage(WebSocketSession session, String type) throws Exception{
		Map<String, Object> payload = new HashMap<>();
		payload.put("type", type);
        payload.put("numOfClients", sessions.size());
        handleTextMessage(session, new TextMessage(new Gson().toJson(payload)));
	}

}