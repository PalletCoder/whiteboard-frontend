import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Manages the realtime collaboration socket: joining rooms, broadcasting scene
 * updates and pointer positions, and tracking connected collaborators.
 */
export function useCollaboration(callbacks) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [collaborators, setCollaborators] = useState([]);
  const [roomId, setRoomId] = useState(null);
  const [mySocketId, setMySocketId] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [awaiting, setAwaiting] = useState(false);

  // Keep the latest callbacks/user in a ref so the socket effect runs once.
  const cbRef = useRef({});
  cbRef.current = callbacks;

  const sceneThrottle = useRef(0);
  const pointerThrottle = useRef(0);
  const roomIdRef = useRef(null);

  useEffect(() => {
    const socket = io(SERVER_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      setMySocketId(socket.id);
      // Re-join automatically after a reconnect.
      if (roomIdRef.current) {
        socket.emit('join-room', { roomId: roomIdRef.current, user: cbRef.current.user });
      }
    });
    socket.on('disconnect', () => setConnected(false));

    socket.on('room-scene', (data) => cbRef.current.onRemoteScene?.(data, true));
    socket.on('scene-update', (data) => cbRef.current.onRemoteScene?.(data, false));
    socket.on('collaborators', (list) => setCollaborators(list || []));
    socket.on('pointer-update', (p) => cbRef.current.onRemotePointer?.(p));
    socket.on('collaborator-left', ({ socketId }) => cbRef.current.onCollaboratorLeft?.(socketId));

    socket.on('joined', ({ role }) => {
      setIsHost(role === 'host');
      setAwaiting(false);
      cbRef.current.onJoined?.(role);
    });
    socket.on('awaiting-approval', () => {
      setAwaiting(true);
      cbRef.current.onAwaitingApproval?.();
    });
    socket.on('join-request', (req) => cbRef.current.onJoinRequest?.(req));
    socket.on('join-rejected', ({ reason }) => {
      roomIdRef.current = null;
      setRoomId(null);
      setAwaiting(false);
      setIsHost(false);
      cbRef.current.onJoinRejected?.(reason);
    });
    socket.on('session-ended', ({ reason }) => {
      roomIdRef.current = null;
      setRoomId(null);
      setAwaiting(false);
      setIsHost(false);
      setCollaborators([]);
      cbRef.current.onSessionEnded?.(reason);
    });
    socket.on('chat-message', (msg) => cbRef.current.onChatMessage?.(msg));
    socket.on('voice-offer', (payload) => cbRef.current.onVoiceOffer?.(payload));
    socket.on('voice-answer', (payload) => cbRef.current.onVoiceAnswer?.(payload));
    socket.on('voice-ice', (payload) => cbRef.current.onVoiceIce?.(payload));
    socket.on('voice-mic-state', (payload) => cbRef.current.onVoiceMicState?.(payload));

    return () => socket.disconnect();
  }, []);

  const join = useCallback((id) => {
    if (!socketRef.current || !id) return;
    roomIdRef.current = id;
    setRoomId(id);
    socketRef.current.emit('join-room', { roomId: id, user: cbRef.current.user });
  }, []);

  const leave = useCallback(() => {
    if (socketRef.current && roomIdRef.current) {
      socketRef.current.emit('leave-room');
    }
    roomIdRef.current = null;
    setRoomId(null);
    setCollaborators([]);
    setIsHost(false);
    setAwaiting(false);
  }, []);

  const endSession = useCallback(() => {
    if (socketRef.current && roomIdRef.current) {
      socketRef.current.emit('end-session');
    }
    roomIdRef.current = null;
    setRoomId(null);
    setCollaborators([]);
    setIsHost(false);
    setAwaiting(false);
  }, []);

  const respondJoin = useCallback((socketId, approved) => {
    socketRef.current?.emit('respond-join', { socketId, approved });
  }, []);

  const sendChat = useCallback((text) => {
    if (!socketRef.current || !roomIdRef.current || !text.trim()) return;
    socketRef.current.emit('chat-message', { text: text.trim() });
  }, []);

  const broadcastScene = useCallback((elements, appState) => {
    if (!socketRef.current || !roomIdRef.current) return;
    const now = Date.now();
    if (now - sceneThrottle.current < 50) return;
    sceneThrottle.current = now;
    socketRef.current.emit('scene-update', { roomId: roomIdRef.current, elements, appState });
  }, []);

  const broadcastPointer = useCallback((x, y) => {
    if (!socketRef.current || !roomIdRef.current) return;
    const now = Date.now();
    if (now - pointerThrottle.current < 40) return;
    pointerThrottle.current = now;
    socketRef.current.emit('pointer-update', { roomId: roomIdRef.current, x, y });
  }, []);

  const sendVoiceOffer = useCallback((to, sdp) => {
    if (!socketRef.current || !roomIdRef.current || !to || !sdp) return;
    socketRef.current.emit('voice-offer', { roomId: roomIdRef.current, to, sdp });
  }, []);

  const sendVoiceAnswer = useCallback((to, sdp) => {
    if (!socketRef.current || !roomIdRef.current || !to || !sdp) return;
    socketRef.current.emit('voice-answer', { roomId: roomIdRef.current, to, sdp });
  }, []);

  const sendVoiceIce = useCallback((to, candidate) => {
    if (!socketRef.current || !roomIdRef.current || !to || !candidate) return;
    socketRef.current.emit('voice-ice', { roomId: roomIdRef.current, to, candidate });
  }, []);

  const sendVoiceMicState = useCallback((enabled) => {
    if (!socketRef.current || !roomIdRef.current) return;
    socketRef.current.emit('voice-mic-state', { roomId: roomIdRef.current, enabled: !!enabled });
  }, []);

  return {
    connected,
    collaborators,
    roomId,
    mySocketId,
    isHost,
    awaiting,
    join,
    leave,
    endSession,
    respondJoin,
    sendChat,
    broadcastScene,
    broadcastPointer,
    sendVoiceOffer,
    sendVoiceAnswer,
    sendVoiceIce,
    sendVoiceMicState,
  };
}
