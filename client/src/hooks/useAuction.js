import { useState, useEffect } from 'react';
import api from '../utils/api';

export function useAuction() {
  const [config, setConfig] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    api.get('/admin/config')
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

  return { config, status };
}
