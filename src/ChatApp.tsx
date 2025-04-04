import React, { useState, useEffect, useRef } from 'react';
import { TelepartyClient, SocketMessageTypes } from 'teleparty-websocket-lib';

interface Message {
  sender: string;
  content: string;
  timestamp: Date;
  isSystem?: boolean;
}

interface SocketEventHandler {
  onMessage: (message: any) => void;
  onConnectionReady: () => void;
  onClose: () => void;
}

const Loader: React.FC = () => (
  <div className="loader-container">
    <div className="loader"></div>
    <p>Connecting to chat server...</p>
  </div>
);

const ChatApp: React.FC = () => {
  const [client, setClient] = useState<TelepartyClient | null>(null);
  const [roomId, setRoomId] = useState<string>('');
  const [nickname, setNickname] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isWebSocketReady, setIsWebSocketReady] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const clientRef = useRef<TelepartyClient | null>(null);

  const initializeClient = () => {
    return new Promise<TelepartyClient>((resolve) => {
      const eventHandler: SocketEventHandler = {
        onMessage: (data: any) => {
          console.log('=== Raw WebSocket Message ===');
          console.log('Message type:', data.type);
          console.log('Full message data:', JSON.stringify(data, null, 2));
          
          try {
            // Handle different message types
            if (data.type === SocketMessageTypes.SEND_MESSAGE) {
              console.log('Processing SEND_MESSAGE:', data);
              const messageData = data.data || {};
              
              // Check if this is a system message
              if (messageData.isSystemMessage) {
                const newMessage = {
                  sender: messageData.userNickname || 'Unknown',
                  content: messageData.body || messageData.message || '',
                  timestamp: new Date(messageData.timestamp || Date.now()),
                  isSystem: true
                };
                console.log('Adding system message to chat:', newMessage);
                setMessages(prev => [...prev, newMessage]);
              } else {
                const newMessage = {
                  sender: messageData.userNickname || messageData.sender || 'Unknown',
                  content: messageData.body || messageData.message || messageData.content || '',
                  timestamp: new Date(messageData.timestamp || Date.now()),
                  isSystem: false
                };
                console.log('Adding regular message to chat:', newMessage);
                setMessages(prev => [...prev, newMessage]);
              }
            } else if (data.type === SocketMessageTypes.JOIN_SESSION) {
              console.log('Processing JOIN_SESSION response:', data);
              
              if (data.data && data.data.messages) {
                console.log('Found messages in JOIN_SESSION:', data.data.messages);
                const formattedMessages = data.data.messages.map((msg: any) => {
                  console.log('Processing history message:', msg);
                  return {
                    sender: msg.userNickname || msg.sender || 'Unknown',
                    content: msg.body || msg.message || msg.content || '',
                    timestamp: new Date(msg.timestamp || Date.now()),
                    isSystem: msg.isSystemMessage || false
                  };
                });
                console.log('Setting message history:', formattedMessages);
                setMessages(prev => [...prev, ...formattedMessages]);
              } else {
                console.log('No messages found in JOIN_SESSION response');
              }
            } else if (data.type === 'userList') {
              console.log('Processing userList:', data);
              const users = data.data || [];
              const userNames = users.map((user: any) => user.userSettings?.userNickname || 'Unknown').join(', ');
              
              // Add system message showing who joined
              const systemMessage = {
                sender: 'System',
                content: `Users in room: ${userNames}`,
                timestamp: new Date(),
                isSystem: true
              };
              console.log('Adding user list message:', systemMessage);
              setMessages(prev => [...prev, systemMessage]);
            } else {
              console.log('Unhandled message type:', data.type);
            }
          } catch (error) {
            console.error('Error processing message:', error);
          }
        },
        onConnectionReady: () => {
          console.log('Connected to WebSocket');
          setIsWebSocketReady(true);
          setIsConnecting(false);
          setIsInitializing(false);
          resolve(clientRef.current!);
        },
        onClose: () => {
          setIsConnected(false);
          setIsConnecting(false);
          setIsWebSocketReady(false);
          console.log('Disconnected from WebSocket');
        }
      };

      const telepartyClient = new TelepartyClient(eventHandler);
      clientRef.current = telepartyClient;
      setClient(telepartyClient);
    });
  };

  const ensureClient = async () => {
    if (!clientRef.current) {
      return initializeClient();
    }
    if (!isWebSocketReady) {
      await new Promise<void>((resolve) => {
        const checkReady = () => {
          if (isWebSocketReady) {
            resolve();
          } else {
            setTimeout(checkReady, 100);
          }
        };
        checkReady();
      });
    }
    return clientRef.current;
  };

  useEffect(() => {
    initializeClient();
    return () => {
      if (clientRef.current) {
        clientRef.current.teardown();
      }
    };
  }, []);

  if (isInitializing) {
    return <Loader />;
  }

  const createRoom = async () => {
    if (!nickname) return;
    try {
      setIsConnecting(true);
      const currentClient = await ensureClient();
      const newRoomId = await currentClient.createChatRoom(nickname);
      console.log('Room created with ID:', newRoomId);
      setRoomId(newRoomId);
      setIsConnected(true);
    } catch (error) {
      console.error('Error creating room:', error);
      setIsConnecting(false);
    }
  };

  const joinRoom = async () => {
    if (!roomId || !nickname) return;
    try {
      setIsConnecting(true);
      const currentClient = await ensureClient();
      console.log('Attempting to join room with ID:', roomId);
      console.log('Current WebSocket state:', {
        isWebSocketReady,
        isConnected,
        isConnecting
      });
      
      const result = await currentClient.joinChatRoom(nickname, roomId);
      console.log('Join room result:', result);
      
      // The messages will be handled by the onMessage event handler
      // when it receives the JOIN_SESSION response
      setIsConnected(true);
    } catch (error) {
      console.error('Error joining room:', error);
      setIsConnecting(false);
    }
  };

  const sendMessage = () => {
    if (!client || !message.trim()) return;
    try {
      console.log('Sending message:', message); // Debug log
      client.sendMessage(SocketMessageTypes.SEND_MESSAGE, {
        message: message.trim(),
        userNickname: nickname
      });
      // Add the message to the local state immediately
      setMessages(prev => [...prev, {
        sender: nickname,
        content: message.trim(),
        timestamp: new Date()
      }]);
      setMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const leaveRoom = () => {
    if (clientRef.current) {
      // Add system message for leaving
      setMessages(prev => [...prev, {
        sender: 'System',
        content: `${nickname} left the room`,
        timestamp: new Date(),
        isSystem: true
      }]);
      
      clientRef.current.teardown();
      clientRef.current = null;
      setClient(null);
      setRoomId('');
      setMessages([]);
      setIsConnected(false);
      setIsConnecting(false);
    }
  };

  return (
    <div className="chat-app">
      {!isConnected ? (
        <div className="connection-form">
          <input
            type="text"
            placeholder="Enter your nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />
          <div className="room-actions">
            <button 
              onClick={createRoom} 
              disabled={isConnecting || !nickname.trim()}
            >
              {isConnecting ? 'Creating Room...' : 'Create Room'}
            </button>
            <div className="join-room">
              <input
                type="text"
                placeholder="Enter room ID"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
              />
              <button 
                onClick={joinRoom} 
                disabled={isConnecting || !nickname.trim() || !roomId.trim()}
              >
                {isConnecting ? 'Joining...' : 'Join Room'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="chat-room">
          <div className="chat-header">
            <div className="user-info">
              <span className="username-label">You are:</span>
              <span className="username">{nickname}</span>
            </div>
            <h3>Room ID: {roomId}</h3>
            <button onClick={leaveRoom} className="leave-button">Leave Room</button>
          </div>
          <div className="messages">
            {messages.length === 0 ? (
              <div className="no-messages">No messages yet. Start the conversation!</div>
            ) : (
              messages.map((msg, index) => (
                <div key={index} className={`message ${msg.isSystem ? 'system-message' : ''}`}>
                  <span className="sender">{msg.sender}: </span>
                  <span className="content">{msg.content}</span>
                  <span className="timestamp">
                    {msg.timestamp.toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
          <div className="message-input">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message..."
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            />
            <button onClick={sendMessage}>Send</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatApp; 