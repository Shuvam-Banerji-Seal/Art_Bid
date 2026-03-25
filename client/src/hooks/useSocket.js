import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

let socketInstance = null;

export function useSocket() {
  const socketRef = useRef(null);

  useEffect(() => {
    if (!socketInstance) {
      socketInstance = io(import.meta.env.VITE_WS_URL || '', {
        withCredentials: true,
        transports: ['websocket', 'polling'],
      });
    }
    socketRef.current = socketInstance;
    return () => {};
  }, []);

  return socketRef.current;
}
