import { useState, useEffect } from 'react';
import api from '../utils/api';
import { io } from 'socket.io-client';

export function useAuction() {
  const [config, setConfig] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    api.get('/auction/config')
      .then(res => {
        setConfig(res.data);
        if (!res.data) { setStatus('not_configured'); return; }
        const now = new Date();
        const start = new Date(res.data.auction_start);
        const end = new Date(res.data.auction_end);
        if (res.data.is_paused) setStatus('paused');
        else if (now < start) setStatus('upcoming');
        else if (now > end) setStatus('ended');
        else setStatus('live');
      })
      .catch(() => setStatus('error'));
  }, []);

  useEffect(() => {
    const socket = io(import.meta.env.VITE_WS_URL || '', { withCredentials: true, reconnection: false });

    socket.on('connect_error', () => {
      socket.disconnect();
    });

    socket.on('auction:start', ({ startsAt }) => {
      setStatus('live');
      setConfig(prev => prev ? { ...prev, auction_start: startsAt } : prev);
    });

    socket.on('auction:end', ({ endedAt }) => {
      setStatus('ended');
      setConfig(prev => prev ? { ...prev, auction_end: endedAt } : prev);
    });

    socket.on('auction:pause', () => {
      setStatus('paused');
      setConfig(prev => prev ? { ...prev, is_paused: true } : prev);
    });

    socket.on('auction:resume', () => {
      setStatus('live');
      setConfig(prev => prev ? { ...prev, is_paused: false } : prev);
    });

    socket.on('auction:config', ({ newEndTime, newMinIncrement }) => {
      setConfig(prev => prev
        ? { ...prev, auction_end: newEndTime, min_bid_increment: newMinIncrement }
        : prev);
    });

    return () => socket.disconnect();
  }, []);

  return { config, status };
}
