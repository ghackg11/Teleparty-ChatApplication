import React from 'react';

interface HomePageProps {
  nickname: string;
  setNickname: (nickname: string) => void;
  roomId: string;
  setRoomId: (roomId: string) => void;
  createRoom: () => void;
  joinRoom: () => void;
  isConnecting: boolean;
}

const HomePage: React.FC<HomePageProps> = ({
  nickname,
  setNickname,
  roomId,
  setRoomId,
  createRoom,
  joinRoom,
  isConnecting
}) => {
  return (
    <div className="home-page">
      <input
        type="text"
        placeholder="Enter your nickname"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        disabled={isConnecting}
      />
      <input
        type="text"
        placeholder="Enter room ID"
        value={roomId}
        onChange={(e) => setRoomId(e.target.value)}
        disabled={isConnecting}
      />
      <button onClick={createRoom} disabled={!nickname || isConnecting}>
        Create Room
      </button>
      <button onClick={joinRoom} disabled={!nickname || !roomId || isConnecting}>
        Join Room
      </button>
    </div>
  );
};

export default HomePage; 