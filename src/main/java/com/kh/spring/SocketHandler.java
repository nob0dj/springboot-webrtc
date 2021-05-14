package com.kh.spring;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * client간 직접 RTC Connection을 맺을 수 있도록 서로의 metadata를 주고받는다.
 */
@Component
public class SocketHandler extends TextWebSocketHandler {

    List<WebSocketSession> sessions = new CopyOnWriteArrayList<>();
    
   
    @Override
    public void handleTextMessage(WebSocketSession session, TextMessage message) throws InterruptedException, IOException {

        for (WebSocketSession sess : sessions) {
        	/**
        	 * 메세지를 발행한 session을 제외하고 전송
        	 */
            if (sess.isOpen() && !session.getId().equals(sess.getId())) {
                sess.sendMessage(message);
            }
        }
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        sessions.add(session);
    }
}