import { useState, useCallback, useRef } from 'react';
import Peer from 'peerjs';
import type { DataConnection } from 'peerjs';

type ShareStatus = 'idle' | 'waiting' | 'connected' | 'transferred' | 'error';
type ReceiveStatus = 'idle' | 'connecting' | 'receiving' | 'received' | 'error';

const PEER_PREFIX = 'cvp-'; // Chess Video Player prefix to avoid collisions

function generateCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

interface SharedGameData {
  name: string;
  pgn: string;
  videoId?: string;
  folder?: string;
}

export function usePeerShare() {
  const [shareStatus, setShareStatus] = useState<ShareStatus>('idle');
  const [shareCode, setShareCode] = useState('');
  const [shareError, setShareError] = useState('');
  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);

  const startSharing = useCallback((gameData: SharedGameData) => {
    const code = generateCode();
    const peerId = PEER_PREFIX + code;

    setShareCode(code);
    setShareStatus('waiting');
    setShareError('');

    const peer = new Peer(peerId);
    peerRef.current = peer;

    peer.on('open', () => {
      setShareStatus('waiting');
    });

    peer.on('connection', (conn) => {
      connRef.current = conn;
      setShareStatus('connected');

      conn.on('open', () => {
        conn.send(gameData);
        setShareStatus('transferred');
        // Auto-cleanup after transfer
        setTimeout(() => {
          peer.destroy();
          peerRef.current = null;
          connRef.current = null;
        }, 3000);
      });
    });

    peer.on('error', (err) => {
      setShareError(err.message || 'Connection failed');
      setShareStatus('error');
    });
  }, []);

  const stopSharing = useCallback(() => {
    connRef.current?.close();
    peerRef.current?.destroy();
    peerRef.current = null;
    connRef.current = null;
    setShareStatus('idle');
    setShareCode('');
    setShareError('');
  }, []);

  return { shareStatus, shareCode, shareError, startSharing, stopSharing };
}

export function usePeerReceive() {
  const [receiveStatus, setReceiveStatus] = useState<ReceiveStatus>('idle');
  const [receiveError, setReceiveError] = useState('');
  const [receivedData, setReceivedData] = useState<SharedGameData | null>(null);
  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);

  const connectToCode = useCallback((code: string) => {
    const targetPeerId = PEER_PREFIX + code;

    setReceiveStatus('connecting');
    setReceiveError('');
    setReceivedData(null);

    const peer = new Peer();
    peerRef.current = peer;

    peer.on('open', () => {
      const conn = peer.connect(targetPeerId, { reliable: true });
      connRef.current = conn;

      conn.on('open', () => {
        setReceiveStatus('receiving');
      });

      conn.on('data', (data) => {
        const gameData = data as SharedGameData;
        setReceivedData(gameData);
        setReceiveStatus('received');
        // Cleanup
        setTimeout(() => {
          peer.destroy();
          peerRef.current = null;
          connRef.current = null;
        }, 1000);
      });

      conn.on('error', (err) => {
        setReceiveError(err.message || 'Connection failed');
        setReceiveStatus('error');
      });
    });

    peer.on('error', (err) => {
      if (err.type === 'peer-unavailable') {
        setReceiveError('Invalid code or sharing session expired.');
      } else {
        setReceiveError(err.message || 'Connection failed');
      }
      setReceiveStatus('error');
    });
  }, []);

  const cancelReceive = useCallback(() => {
    connRef.current?.close();
    peerRef.current?.destroy();
    peerRef.current = null;
    connRef.current = null;
    setReceiveStatus('idle');
    setReceiveError('');
    setReceivedData(null);
  }, []);

  return { receiveStatus, receiveError, receivedData, connectToCode, cancelReceive };
}
