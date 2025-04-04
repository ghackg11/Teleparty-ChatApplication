import React, { useState, useEffect, useRef } from 'react';
import { TelepartyClient, SocketEventHandler, SocketMessageTypes } from 'teleparty-websocket-lib';
import './ChatApp.css';

interface Message {
  sender: string;
  content: string;
  timestamp: Date;
  isSystem?: boolean;
}

const App: React.FC = () => {
  const [client, setClient] = useState<TelepartyClient | null>(null);
  const [roomId, setRoomId] = useState<string>('');
  const [roomIdInput, setRoomIdInput] = useState<string>('');
  const [nickname, setNickname] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [users, setUsers] = useState<string[]>([]);
  const [showUserList, setShowUserList] = useState<boolean>(false);
  const userListRef = useRef<HTMLDivElement>(null);
  const clientRef = React.useRef<TelepartyClient | null>(null);

  // Add click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userListRef.current && !userListRef.current.contains(event.target as Node)) {
        setShowUserList(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Initialize WebSocket client
  useEffect(() => {
    const eventHandler: SocketEventHandler = {
      onMessage: (data: any) => {
        try {
          if (data.type === SocketMessageTypes.SEND_MESSAGE) {
            const messageData = data.data || {};
            if (messageData.isSystemMessage) {
              const messageContent = messageData.body || messageData.message || '';
              const isJoinMessage = messageContent.includes('joined');
              const isLeaveMessage = messageContent.includes('left');
              
              const newMessage = {
                sender: 'System',
                content: isJoinMessage ? 
                  `${messageData.userNickname || 'Unknown'} joined the party` :
                  isLeaveMessage ?
                  `${messageData.userNickname || 'Unknown'} left the party` :
                  messageContent,
                timestamp: new Date(messageData.timestamp || Date.now()),
                isSystem: true
              };
              setMessages(prev => [...prev, newMessage]);
            } else {
              const newMessage = {
                sender: messageData.userNickname || messageData.sender || 'Unknown',
                content: messageData.body || messageData.message || messageData.content || '',
                timestamp: new Date(messageData.timestamp || Date.now()),
                isSystem: false
              };
              setMessages(prev => [...prev, newMessage]);
            }
          } else if (data.type === SocketMessageTypes.JOIN_SESSION) {
            if (data.data && data.data.messages) {
              const formattedMessages = data.data.messages.map((msg: any) => ({
                sender: msg.userNickname || msg.sender || 'Unknown',
                content: msg.body || msg.message || msg.content || '',
                timestamp: new Date(msg.timestamp || Date.now()),
                isSystem: msg.isSystemMessage || false
              }));
              setMessages(prev => [...prev, ...formattedMessages]);
            }
          } else if (data.type === 'userList') {
            const userList = data.data || [];
            const userNames = userList.map((user: any) => user.userSettings?.userNickname || 'Unknown');
            setUsers(userNames);
          }
        } catch (error) {
          console.error('Error processing message:', error);
        }
      },
      onConnectionReady: () => {
        setIsConnecting(false);
      },
      onClose: () => {
        setIsConnecting(false);
      }
    };

    const telepartyClient = new TelepartyClient(eventHandler);
    clientRef.current = telepartyClient;
    setClient(telepartyClient);

    return () => {
      if (clientRef.current) {
        clientRef.current.teardown();
      }
    };
  }, []);

  const joinRoom = async (roomIdToJoin: string, nicknameToUse: string) => {
    if (!roomIdToJoin || !nicknameToUse) return;
    try {
      setIsConnecting(true);
      await clientRef.current?.joinChatRoom(nicknameToUse, roomIdToJoin);
      setRoomId(roomIdToJoin);
      setNickname(nicknameToUse);
    } catch (error) {
      console.error('Error joining room:', error);
      setIsConnecting(false);
    }
  };

  const createRoom = async () => {
    if (!nickname) return;
    try {
      setIsConnecting(true);
      const newRoomId = await clientRef.current?.createChatRoom(nickname);
      if (newRoomId) {
        setRoomId(newRoomId);
      }
    } catch (error) {
      console.error('Error creating room:', error);
      setIsConnecting(false);
    }
  };

  const sendMessage = () => {
    if (!client || !message.trim()) return;
    try {
      if (!clientRef.current || !roomId) return;
      const messageContent = message.trim();
      clientRef.current.sendMessage(SocketMessageTypes.SEND_MESSAGE, {
        body: messageContent,
        userNickname: nickname
      });
      setMessage('');
    } catch (error: any) {
      console.error('Error sending message:', error);
    }
  };

  const leaveRoom = async () => {
    if (clientRef.current) {
      try {
        // Add system message for leaving
        setMessages(prev => [...prev, {
          sender: 'System',
          content: `${nickname} left the party`,
          timestamp: new Date(),
          isSystem: true
        }]);
        
        // Tear down the current client
        clientRef.current.teardown();
        clientRef.current = null;
        setClient(null);
        
        // Reset all state
        setRoomId('');
        setRoomIdInput('');
        setNickname('');
        setMessages([]);
        setUsers([]);
        setIsConnecting(false);

        // Reinitialize the client
        const eventHandler: SocketEventHandler = {
          onMessage: (data: any) => {
            try {
              if (data.type === SocketMessageTypes.SEND_MESSAGE) {
                const messageData = data.data || {};
                if (messageData.isSystemMessage) {
                  const messageContent = messageData.body || messageData.message || '';
                  const isJoinMessage = messageContent.includes('joined');
                  const isLeaveMessage = messageContent.includes('left');
                  
                  const newMessage = {
                    sender: 'System',
                    content: isJoinMessage ? 
                      `${messageData.userNickname || 'Unknown'} joined the party` :
                      isLeaveMessage ?
                      `${messageData.userNickname || 'Unknown'} left the party` :
                      messageContent,
                    timestamp: new Date(messageData.timestamp || Date.now()),
                    isSystem: true
                  };
                  setMessages(prev => [...prev, newMessage]);
                } else {
                  const newMessage = {
                    sender: messageData.userNickname || messageData.sender || 'Unknown',
                    content: messageData.body || messageData.message || messageData.content || '',
                    timestamp: new Date(messageData.timestamp || Date.now()),
                    isSystem: false
                  };
                  setMessages(prev => [...prev, newMessage]);
                }
              } else if (data.type === SocketMessageTypes.JOIN_SESSION) {
                if (data.data && data.data.messages) {
                  const formattedMessages = data.data.messages.map((msg: any) => ({
                    sender: msg.userNickname || msg.sender || 'Unknown',
                    content: msg.body || msg.message || msg.content || '',
                    timestamp: new Date(msg.timestamp || Date.now()),
                    isSystem: msg.isSystemMessage || false
                  }));
                  setMessages(prev => [...prev, ...formattedMessages]);
                }
              } else if (data.type === 'userList') {
                const userList = data.data || [];
                const userNames = userList.map((user: any) => user.userSettings?.userNickname || 'Unknown');
                setUsers(userNames);
              }
            } catch (error) {
              console.error('Error processing message:', error);
            }
          },
          onConnectionReady: () => {
            setIsConnecting(false);
          },
          onClose: () => {
            setIsConnecting(false);
          }
        };

        const telepartyClient = new TelepartyClient(eventHandler);
        clientRef.current = telepartyClient;
        setClient(telepartyClient);
      } catch (error) {
        console.error('Error leaving room:', error);
        setIsConnecting(false);
      }
    }
  };

  return (
    <div className="chat-app">
      {!roomId ? (
        <div className="connection-form">
          <h2>Join Chat Room</h2>
          <div className="input-group">
            <input
              type="text"
              placeholder="Enter your nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              disabled={isConnecting}
            />
          </div>
          <div className="input-group">
            <input
              type="text"
              placeholder="Enter room ID"
              value={roomIdInput}
              onChange={(e) => setRoomIdInput(e.target.value)}
              disabled={isConnecting}
            />
          </div>
          <div className="button-group">
            <button
              onClick={createRoom}
              disabled={!nickname || isConnecting}
            >
              Create Room
            </button>
            <button
              onClick={() => joinRoom(roomIdInput, nickname)}
              disabled={!roomIdInput || !nickname || isConnecting}
            >
              Join Room
            </button>
          </div>
        </div>
      ) : (
        <div className="chat-room">
          <div className="chat-header">
            <div className="header-left">
              <h2>Chat Room: {roomId}</h2>
              <p>Nickname: {nickname}</p>
            </div>
            <div className="header-right">
              <div className="user-list-container" ref={userListRef}>
                <button 
                  className="user-list-button"
                  onClick={() => setShowUserList(!showUserList)}
                >
                  👥
                </button>
                {showUserList && (
                  <div className="user-list-dropdown">
                    <h3>Users in Room</h3>
                    <ul>
                      {users.map((user, index) => (
                        <li key={index}>{user}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <button onClick={leaveRoom} className="leave-button">
                Leave Room
              </button>
            </div>
          </div>
          <div className="chat-messages">
            {messages.length === 0 ? (
              <p className="empty-message">Start the conversation!</p>
            ) : (
              messages.map((msg, index) => (
                <div
                  key={index}
                  className={`message ${msg.sender === nickname ? 'sent' : 'received'} ${msg.isSystem ? 'system' : ''}`}
                >
                  <div className="message-header">
                    <span className="sender">
                      {msg.sender === nickname ? 'You' : msg.sender}
                    </span>
                    <span className="timestamp">
                      {msg.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="message-content">{msg.content}</div>
                </div>
              ))
            )}
          </div>
          <div className="chat-input">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type a message..."
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            />
            <button onClick={sendMessage}>Send</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
