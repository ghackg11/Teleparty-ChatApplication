import React, { useState, useEffect, useRef } from 'react';
import { TelepartyClient, SocketEventHandler, SocketMessageTypes } from 'teleparty-websocket-lib';
import './ChatApp.css';

interface Message {
  sender: string;
  content: string;
  timestamp: Date;
  isSystem?: boolean;
}

interface User {
  id: string;
  nickname: string;
  userId: string;
}

const App: React.FC = () => {
  const [client, setClient] = useState<TelepartyClient | null>(null);
  const [roomId, setRoomId] = useState<string>('');
  const [roomIdInput, setRoomIdInput] = useState<string>('');
  const [nickname, setNickname] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [users, setUsers] = useState<User[]>([]);
  const [showUserList, setShowUserList] = useState<boolean>(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const userListRef = useRef<HTMLDivElement>(null);
  const clientRef = React.useRef<TelepartyClient | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
          console.log('Received message:', data);
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
              console.log('Adding system message:', newMessage);
              setMessages(prev => [...prev, newMessage]);
            } else {
              const newMessage = {
                sender: messageData.userNickname || messageData.sender || 'Unknown',
                content: messageData.body || messageData.message || messageData.content || '',
                timestamp: new Date(messageData.timestamp || Date.now()),
                isSystem: false
              };
              console.log('Adding regular message:', newMessage);
              setMessages(prev => [...prev, newMessage]);
            }
          } else if (data.type === SocketMessageTypes.JOIN_SESSION) {
            console.log('Processing JOIN_SESSION:', data);
            if (data.data) {
              // Extract user ID from the initial message
              const userId = data.data.userId || data.data.socketConnectionId;
              console.log('Extracted user ID:', userId);
              
              if (data.data.messages) {
                console.log('Found chat history:', data.data.messages);
                const formattedMessages = data.data.messages.map((msg: any) => {
                  const isSystemMessage = msg.isSystemMessage || 
                    (msg.body && (msg.body.includes('joined') || msg.body.includes('left')));
                  
                  return {
                    sender: msg.userNickname || msg.sender || 'Unknown',
                    content: msg.body || msg.message || msg.content || '',
                    timestamp: new Date(msg.timestamp || Date.now()),
                    isSystem: isSystemMessage
                  };
                });
                console.log('Setting chat history:', formattedMessages);
                setMessages(formattedMessages);
              } else {
                console.log('No chat history found in JOIN_SESSION');
                setMessages([]);
              }
            }
          } else if (data.type === 'userList') {
            console.log('Received user list data:', JSON.stringify(data, null, 2));
            const userList = data.data || [];
            console.log('Raw user list:', JSON.stringify(userList.map((user: any) => ({
              socketConnectionId: user.socketConnectionId,
              userId: user.userId,
              nickname: user.userSettings?.userNickname || user.nickname || user.username,
              userSettings: {
                ...user.userSettings,
                userId: user.userId
              }
            })), null, 2));
            
            // Store the complete user data with both ID and nickname
            const formattedUsers = userList.map((user: any) => {
              console.log('Processing user object:', JSON.stringify(user, null, 2));
              console.log('User socket ID:', user.socketConnectionId);
              console.log('User ID:', user.userId);
              console.log('User settings:', user.userSettings);
              
              return {
                id: user.socketConnectionId,
                nickname: user.userSettings?.userNickname || 'Unknown',
                userId: user.userId || user.socketConnectionId // Use socketConnectionId as fallback
              };
            });
            console.log('Formatted users:', JSON.stringify(formattedUsers, null, 2));
            setUsers(formattedUsers);
          } else if (data.type === SocketMessageTypes.SET_TYPING_PRESENCE) {
            console.log('Received typing presence:', data);
            const typingData = data.data || {};
            const usersTyping = typingData.usersTyping || [];
            
            // Get current user's ID
            const currentUser = users.find(u => u.nickname === nickname);
            const currentUserId = currentUser?.id;
            
            // Filter out current user's typing status
            const otherUsersTyping = usersTyping.filter((id: string) => id !== currentUserId);
            
            // Use the stored user data to get nicknames
            const typingNicknames = otherUsersTyping.map((typingId: string) => {
              // Try to find user by socket ID first, then by user ID
              const user = users.find(u => u.id === typingId) || users.find(u => u.userId === typingId);
              console.log('Looking up typing user:', typingId, 'Found:', user);
              return user?.nickname || 'Someone';
            });

            console.log('Users typing:', typingNicknames);
            
            // Update the typing users set
            setTypingUsers(new Set(typingNicknames));
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

  // Add useEffect to log messages state changes
  useEffect(() => {
    console.log('Messages state updated:', messages);
  }, [messages]);

  // Add useEffect to log user state changes
  useEffect(() => {
    console.log('Users state updated:', users);
  }, [users]);

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
                const formattedUsers = userList.map((user: any) => ({
                  id: user.socketConnectionId,
                  nickname: user.userSettings?.userNickname || 'Unknown',
                  userId: user.userId
                }));
                setUsers(formattedUsers);
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

  const handleMessageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newMessage = e.target.value;
    setMessage(newMessage);

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Send typing indicator
    if (client && roomId) {
      const currentUser = users.find(u => u.nickname === nickname);
      console.log('Sending typing indicator for user:', nickname, 'with ID:', currentUser?.id);
      client.sendMessage(SocketMessageTypes.SET_TYPING_PRESENCE, {
        typing: true,
        userId: currentUser?.id || nickname
      });

      // Set timeout to stop typing indicator after 3 seconds
      typingTimeoutRef.current = setTimeout(() => {
        if (client && roomId) {
          console.log('Stopping typing indicator for user:', nickname, 'with ID:', currentUser?.id);
          client.sendMessage(SocketMessageTypes.SET_TYPING_PRESENCE, {
            typing: false,
            userId: currentUser?.id || nickname
          });
        }
      }, 3000);
    }
  };

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

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
              {typingUsers.size > 0 && (
                <div className="typing-indicator">
                  {typingUsers.size === 1 ? 'Someone is typing...' : 'Multiple people are typing...'}
                </div>
              )}
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
                        <li key={index}>
                          <span className="user-nickname">{user.nickname}</span>
                          <span className="user-id">({user.id})</span>
                        </li>
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
              messages.map((msg, index) => {
                console.log('Rendering message:', msg);
                return (
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
                );
              })
            )}
          </div>
          <div className="chat-input">
            <input
              type="text"
              value={message}
              onChange={handleMessageChange}
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
