import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Share2, MessageSquare, Mic, MicOff } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import {
  TOOL, SHAPE_TOOLS, DEFAULT_APP_STATE, DEFAULT_ELEMENT_STYLE,
  ZOOM_MIN, ZOOM_MAX, FONT_FAMILIES,
} from '../whiteboard/constants';
import {
  createElement, duplicateElement, normalizeElement, resizeElement, rotateElement,
  hitTest, isElementInBox, getHandleAt, getBoundingBox, measureText,
  isLinearType, isBendHandleAt, setBend,
} from '../whiteboard/elements';
import { renderScene } from '../whiteboard/render';
import { useHistory } from '../whiteboard/useHistory';
import { useCollaboration } from '../whiteboard/useCollaboration';
import { isMermaid, renderMermaidToDataUrl } from '../whiteboard/mermaid';
import * as api from '../whiteboard/api';

import TopToolbar from '../components/whiteboard/TopToolbar';
import PropertiesPanel from '../components/whiteboard/PropertiesPanel';
import ZoomControls from '../components/whiteboard/ZoomControls';
import MainMenu from '../components/whiteboard/MainMenu';
import ShareDialog from '../components/whiteboard/ShareDialog';
import WorkspacesDialog from '../components/whiteboard/WorkspacesDialog';
import Collaborators from '../components/whiteboard/Collaborators';
import CollabCursors from '../components/whiteboard/CollabCursors';
import ChatPanel from '../components/whiteboard/ChatPanel';
import JoinRequests from '../components/whiteboard/JoinRequests';
import MermaidDialog from '../components/whiteboard/MermaidDialog';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const TOOL_SHORTCUTS = {
  '1': TOOL.SELECTION, v: TOOL.SELECTION,
  '2': TOOL.RECTANGLE, r: TOOL.RECTANGLE,
  '3': TOOL.DIAMOND, d: TOOL.DIAMOND,
  '4': TOOL.ELLIPSE, o: TOOL.ELLIPSE,
  '5': TOOL.ARROW, a: TOOL.ARROW,
  '6': TOOL.LINE, l: TOOL.LINE,
  '7': TOOL.DRAW, p: TOOL.DRAW,
  '8': TOOL.TEXT, t: TOOL.TEXT,
  '9': TOOL.IMAGE,
  '0': TOOL.ERASER, e: TOOL.ERASER,
  h: TOOL.HAND,
};

export default function WhiteboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [elements, setElementsState] = useState([]);
  const [appState, setAppStateState] = useState(DEFAULT_APP_STATE);
  const [activeTool, setActiveToolState] = useState(TOOL.SELECTION);
  const [toolLocked, setToolLocked] = useState(false);
  const [selectedIds, setSelectedIdsState] = useState([]);
  const [currentStyle, setCurrentStyle] = useState({ ...DEFAULT_ELEMENT_STYLE });
  const [selectionBox, setSelectionBox] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [tick, setTick] = useState(0);

  const [shareOpen, setShareOpen] = useState(false);
  const [workspacesOpen, setWorkspacesOpen] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [currentRoomId, setCurrentRoomId] = useState(null);
  const [workspaceName, setWorkspaceName] = useState('Untitled workspace');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [remotePointers, setRemotePointers] = useState({});
  const [eraserHover, setEraserHover] = useState([]);
  const [dynamicCursor, setDynamicCursor] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [micOn, setMicOn] = useState(false);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [mermaidOpen, setMermaidOpen] = useState(false);
  const [notice, setNotice] = useState(null);

  // Refs mirroring state for use inside imperative event handlers.
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const jsonInputRef = useRef(null);
  const textareaRef = useRef(null);
  const eraserHoverRef = useRef([]);
  const dynamicCursorRef = useRef(null);
  const chatOpenRef = useRef(chatOpen);
  const mySocketIdRef = useRef(null);
  const peerConnectionsRef = useRef(new Map());
  const remoteAudioRef = useRef(new Map());
  const localAudioStreamRef = useRef(null);

  const elementsRef = useRef(elements);
  const appStateRef = useRef(appState);
  const activeToolRef = useRef(activeTool);
  const toolLockedRef = useRef(toolLocked);
  const selectedIdsRef = useRef(selectedIds);
  const currentStyleRef = useRef(currentStyle);
  const currentRoomIdRef = useRef(currentRoomId);
  const editingIdRef = useRef(editingId);
  const interaction = useRef({ type: 'none' });
  const spaceDownRef = useRef(false);
  const pendingImagePoint = useRef(null);
  const clipboardRef = useRef([]);
  const applyingRemoteRef = useRef(false);

  useEffect(() => { elementsRef.current = elements; }, [elements]);
  useEffect(() => { appStateRef.current = appState; }, [appState]);
  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);
  useEffect(() => { toolLockedRef.current = toolLocked; }, [toolLocked]);
  useEffect(() => { selectedIdsRef.current = selectedIds; }, [selectedIds]);
  useEffect(() => { currentStyleRef.current = currentStyle; }, [currentStyle]);
  useEffect(() => { currentRoomIdRef.current = currentRoomId; }, [currentRoomId]);
  useEffect(() => { editingIdRef.current = editingId; }, [editingId]);
  useEffect(() => { chatOpenRef.current = chatOpen; }, [chatOpen]);

  // Focus the text editor whenever editing begins (fixes "can't type").
  useEffect(() => {
    if (editingId && textareaRef.current) {
      const ta = textareaRef.current;
      ta.focus();
      const len = ta.value.length;
      try { ta.setSelectionRange(len, len); } catch { /* ignore */ }
    }
  }, [editingId]);

  const destroyPeer = useCallback((socketId) => {
    const pc = peerConnectionsRef.current.get(socketId);
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      pc.close();
      peerConnectionsRef.current.delete(socketId);
    }
    const audio = remoteAudioRef.current.get(socketId);
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      remoteAudioRef.current.delete(socketId);
    }
  }, []);

  const destroyAllPeers = useCallback(() => {
    for (const socketId of Array.from(peerConnectionsRef.current.keys())) {
      destroyPeer(socketId);
    }
  }, [destroyPeer]);

  const stopLocalAudio = useCallback(() => {
    const stream = localAudioStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      localAudioStreamRef.current = null;
    }
  }, []);

  const ensureLocalAudio = useCallback(async () => {
    if (localAudioStreamRef.current) return localAudioStreamRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    localAudioStreamRef.current = stream;
    return stream;
  }, []);

  const createPeerConnection = useCallback((socketId) => {
    let pc = peerConnectionsRef.current.get(socketId);
    if (pc) return pc;

    pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    peerConnectionsRef.current.set(socketId, pc);

    const stream = localAudioStreamRef.current;
    if (stream) {
      stream.getAudioTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        collabRef.current.sendVoiceIce(socketId, event.candidate);
      }
    };

    pc.ontrack = (event) => {
      const [streamOut] = event.streams;
      if (!streamOut) return;
      let audio = remoteAudioRef.current.get(socketId);
      if (!audio) {
        audio = new Audio();
        audio.autoplay = true;
        audio.playsInline = true;
        remoteAudioRef.current.set(socketId, audio);
      }
      audio.srcObject = streamOut;
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {});
      }
    };

    pc.onconnectionstatechange = () => {
      if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
        destroyPeer(socketId);
      }
    };

    return pc;
  }, [destroyPeer]);

  const startOfferForPeer = useCallback(async (socketId) => {
    const myId = mySocketIdRef.current;
    if (!myId || !socketId || myId === socketId || myId > socketId) return;
    try {
      const pc = createPeerConnection(socketId);
      if (pc.signalingState !== 'stable') return;
      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);
      collabRef.current.sendVoiceOffer(socketId, offer);
    } catch {
      destroyPeer(socketId);
    }
  }, [createPeerConnection, destroyPeer]);

  const setCursor = useCallback((c) => {
    if (dynamicCursorRef.current !== c) {
      dynamicCursorRef.current = c;
      setDynamicCursor(c);
    }
  }, []);

  const setEraserHoverIds = useCallback((ids) => {
    const key = ids.join(',');
    if (eraserHoverRef.current.join(',') !== key) {
      eraserHoverRef.current = ids;
      setEraserHover(ids);
    }
  }, []);

  const scheduleRender = useCallback(() => setTick((t) => t + 1), []);

  const history = useHistory([]);

  // -- Collaboration -------------------------------------------------------
  const onRemoteScene = useCallback((data, isInitial) => {
    applyingRemoteRef.current = true;
    if (Array.isArray(data.elements)) {
      elementsRef.current = data.elements;
      setElementsState(data.elements);
      if (isInitial) history.reset(data.elements);
    }
    if (data.appState && isInitial) {
      setAppStateState((prev) => ({
        ...prev,
        viewBackgroundColor: data.appState.viewBackgroundColor || prev.viewBackgroundColor,
        gridSize: data.appState.gridSize ?? prev.gridSize,
      }));
    }
    if (isInitial) {
      setSelectedIdsState([]);
      selectedIdsRef.current = [];
    }
    setTimeout(() => { applyingRemoteRef.current = false; }, 0);
  }, [history]);

  const onRemotePointer = useCallback((p) => {
    setRemotePointers((prev) => ({
      ...prev,
      [p.socketId]: { sceneX: p.x, sceneY: p.y, username: p.username, color: p.color },
    }));
  }, []);

  const onCollaboratorLeft = useCallback((socketId) => {
    setRemotePointers((prev) => {
      const next = { ...prev };
      delete next[socketId];
      return next;
    });
    destroyPeer(socketId);
  }, [destroyPeer]);

  const onChatMessage = useCallback((msg) => {
    setChatMessages((prev) => [...prev, msg]);
    if (msg.socketId !== mySocketIdRef.current && !chatOpenRef.current) {
      setUnreadMessages((count) => count + 1);
      setNotice(`${msg.username || 'Collaborator'}: ${msg.text}`);
    }
  }, []);

  const onVoiceOffer = useCallback(async ({ from, sdp }) => {
    if (!micOn || !from || !sdp) return;
    try {
      const pc = createPeerConnection(from);
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      collabRef.current.sendVoiceAnswer(from, answer);
    } catch {
      destroyPeer(from);
    }
  }, [createPeerConnection, destroyPeer, micOn]);

  const onVoiceAnswer = useCallback(async ({ from, sdp }) => {
    if (!micOn || !from || !sdp) return;
    const pc = peerConnectionsRef.current.get(from);
    if (!pc) return;
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    } catch {
      destroyPeer(from);
    }
  }, [destroyPeer, micOn]);

  const onVoiceIce = useCallback(async ({ from, candidate }) => {
    if (!micOn || !from || !candidate) return;
    const pc = peerConnectionsRef.current.get(from);
    if (!pc) return;
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch {
      // Ignore stale ICE.
    }
  }, [micOn]);

  const onVoiceMicState = useCallback(({ socketId, enabled, username }) => {
    if (!socketId || socketId === mySocketIdRef.current) return;
    if (!enabled) destroyPeer(socketId);
    setNotice(`${username || 'Collaborator'} ${enabled ? 'turned mic on' : 'muted mic'}`);
  }, [destroyPeer]);

  const onJoinRequest = useCallback((req) => {
    setPendingRequests((prev) => (
      prev.some((r) => r.socketId === req.socketId) ? prev : [...prev, req]
    ));
  }, []);

  const onJoinRejected = useCallback((reason) => {
    setCurrentRoomId(null);
    window.history.replaceState(null, '', '/whiteboard');
    setNotice(reason || 'Your request to join was declined.');
  }, []);

  const onSessionEnded = useCallback((reason) => {
    destroyAllPeers();
    stopLocalAudio();
    setMicOn(false);
    // Guests are returned to their own default board.
    elementsRef.current = [];
    setElementsState([]);
    setAppStateState(DEFAULT_APP_STATE);
    history.reset([]);
    setSelectedIdsState([]);
    selectedIdsRef.current = [];
    setCurrentRoomId(null);
    setChatOpen(false);
    setChatMessages([]);
    setUnreadMessages(0);
    setPendingRequests([]);
    setRemotePointers({});
    setDirty(false);
    window.history.replaceState(null, '', '/whiteboard');
    setNotice(reason || 'The session has ended.');
  }, [history, destroyAllPeers, stopLocalAudio]);

  const collab = useCollaboration({
    user,
    onRemoteScene,
    onRemotePointer,
    onCollaboratorLeft,
    onChatMessage,
    onJoinRequest,
    onJoinRejected,
    onSessionEnded,
    onVoiceOffer,
    onVoiceAnswer,
    onVoiceIce,
    onVoiceMicState,
  });
  const collabRef = useRef(collab);
  collabRef.current = collab;

  useEffect(() => {
    mySocketIdRef.current = collab.mySocketId;
  }, [collab.mySocketId]);

  useEffect(() => {
    return () => {
      destroyAllPeers();
      stopLocalAudio();
    };
  }, [destroyAllPeers, stopLocalAudio]);

  useEffect(() => {
    if (!micOn || !collab.roomId || !collab.mySocketId) return;
    collab.collaborators
      .map((c) => c.socketId)
      .filter((sid) => sid && sid !== collab.mySocketId)
      .forEach((sid) => {
        startOfferForPeer(sid);
      });
  }, [micOn, collab.roomId, collab.mySocketId, collab.collaborators, startOfferForPeer]);

  useEffect(() => {
    if (collab.roomId || !micOn) return;
    destroyAllPeers();
    stopLocalAudio();
    setMicOn(false);
  }, [collab.roomId, micOn, destroyAllPeers, stopLocalAudio]);

  const toggleMic = useCallback(async () => {
    if (!collab.roomId) return;
    if (micOn) {
      collabRef.current.sendVoiceMicState(false);
      destroyAllPeers();
      stopLocalAudio();
      setMicOn(false);
      return;
    }
    try {
      await ensureLocalAudio();
      setMicOn(true);
      collabRef.current.sendVoiceMicState(true);
      const others = collabRef.current.collaborators
        .map((c) => c.socketId)
        .filter((sid) => sid && sid !== mySocketIdRef.current);
      others.forEach((sid) => {
        startOfferForPeer(sid);
      });
    } catch {
      setNotice('Microphone access is blocked. Allow mic access and try again.');
    }
  }, [micOn, collab.roomId, ensureLocalAudio, destroyAllPeers, stopLocalAudio, startOfferForPeer]);

  // -- Element mutation helpers -------------------------------------------
  const updateElements = useCallback((next, broadcast = true) => {
    elementsRef.current = next;
    setElementsState(next);
    if (broadcast && !applyingRemoteRef.current) {
      collabRef.current.broadcastScene(next, appStateRef.current);
    }
  }, []);

  const commitElements = useCallback((next) => {
    elementsRef.current = next;
    setElementsState(next);
    history.record(next);
    setDirty(true);
    collabRef.current.broadcastScene(next, appStateRef.current);
  }, [history]);

  const setActiveTool = useCallback((tool) => {
    setActiveToolState(tool);
    if (tool !== TOOL.SELECTION) {
      setSelectedIdsState([]);
      selectedIdsRef.current = [];
    }
  }, []);

  // -- Coordinate helpers --------------------------------------------------
  const getScenePoint = useCallback((clientX, clientY) => {
    const rect = containerRef.current.getBoundingClientRect();
    const { zoom, scrollX, scrollY } = appStateRef.current;
    return [
      (clientX - rect.left - scrollX) / zoom,
      (clientY - rect.top - scrollY) / zoom,
    ];
  }, []);

  // Hover feedback: eraser highlight, plus grab/move cursors for selection.
  const handleHover = useCallback((e) => {
    if (interaction.current.type !== 'none') return;
    const [x, y] = getScenePoint(e.clientX, e.clientY);
    const { zoom } = appStateRef.current;
    const tool = activeToolRef.current;

    if (tool === TOOL.ERASER) {
      const ids = elementsRef.current.filter((el) => hitTest(el, x, y, 6 / zoom)).map((el) => el.id);
      setEraserHoverIds(ids);
      setCursor('cell');
      return;
    }
    if (eraserHoverRef.current.length) setEraserHoverIds([]);

    if (tool === TOOL.SELECTION) {
      const ids = selectedIdsRef.current;
      if (ids.length === 1) {
        const el = elementsRef.current.find((it) => it.id === ids[0]);
        if (el) {
          if (isLinearType(el.type) && isBendHandleAt(el, x, y, zoom)) { setCursor('grab'); return; }
          if (getHandleAt(el, x, y, zoom)) { setCursor('grab'); return; }
        }
      }
      const over = [...elementsRef.current].reverse().find((el) => hitTest(el, x, y, 8 / zoom));
      setCursor(over ? 'move' : null);
      return;
    }
    setCursor(null);
  }, [getScenePoint, setCursor, setEraserHoverIds]);

  // -- Text editing (declared before pointer handlers that call it) --------
  const createTextAt = useCallback((x, y) => {
    const el = createElement(TOOL.TEXT, x, y, currentStyleRef.current);
    el.text = '';
    const next = [...elementsRef.current, el];
    elementsRef.current = next;
    setElementsState(next);
    setSelectedIdsState([el.id]);
    selectedIdsRef.current = [el.id];
    setEditingId(el.id);
  }, []);

  const handleTextChange = useCallback((value) => {
    const id = editingIdRef.current;
    const el = elementsRef.current.find((e) => e.id === id);
    if (!el) return;
    const { width, height } = measureText(value || ' ', el.fontSize, el.fontFamily);
    const next = elementsRef.current.map((e) => (e.id === id ? { ...e, text: value, width, height } : e));
    updateElements(next);
  }, [updateElements]);

  const commitText = useCallback(() => {
    const id = editingIdRef.current;
    if (!id) return;
    setEditingId(null);
    editingIdRef.current = null;
    const el = elementsRef.current.find((e) => e.id === id);
    if (!el) return;
    if (!String(el.text).trim()) {
      commitElements(elementsRef.current.filter((e) => e.id !== id));
    } else {
      history.record(elementsRef.current);
      setDirty(true);
      collabRef.current.broadcastScene(elementsRef.current, appStateRef.current);
    }
    if (!toolLockedRef.current) setActiveToolState(TOOL.SELECTION);
  }, [commitElements, history]);

  const eraseAt = useCallback((x, y) => {
    const { zoom } = appStateRef.current;
    const hitIds = elementsRef.current.filter((e) => hitTest(e, x, y, 6 / zoom)).map((e) => e.id);
    if (hitIds.length) {
      interaction.current.erased = true;
      updateElements(elementsRef.current.filter((e) => !hitIds.includes(e.id)));
      setEraserHoverIds([]);
    }
  }, [updateElements, setEraserHoverIds]);

  // -- Pointer interaction -------------------------------------------------
  const beginInteraction = useCallback((clientX, clientY, shiftKey, button) => {
    const [x, y] = getScenePoint(clientX, clientY);
    const tool = activeToolRef.current;
    const { zoom } = appStateRef.current;

    if (tool === TOOL.HAND || spaceDownRef.current || button === 1) {
      interaction.current = {
        type: 'pan',
        startClientX: clientX,
        startClientY: clientY,
        startScrollX: appStateRef.current.scrollX,
        startScrollY: appStateRef.current.scrollY,
      };
      return;
    }

    if (tool === TOOL.IMAGE) {
      pendingImagePoint.current = [x, y];
      fileInputRef.current?.click();
      return;
    }

    if (tool === TOOL.TEXT) {
      createTextAt(x, y);
      return;
    }

    if (tool === TOOL.ERASER) {
      interaction.current = { type: 'erase', erased: false };
      eraseAt(x, y);
      return;
    }

    if (tool === TOOL.SELECTION) {
      const ids = selectedIdsRef.current;
      if (ids.length === 1) {
        const el = elementsRef.current.find((e) => e.id === ids[0]);
        if (el) {
          if (isLinearType(el.type) && isBendHandleAt(el, x, y, zoom)) {
            interaction.current = {
              type: 'bend',
              original: { ...el, points: el.points.map((p) => [...p]) },
              moved: false,
            };
            return;
          }
          const handle = getHandleAt(el, x, y, zoom);
          if (handle === 'rotation') {
            interaction.current = { type: 'rotate', original: { ...el }, moved: false };
            return;
          }
          if (handle) {
            interaction.current = { type: 'resize', handle, original: { ...el }, moved: false };
            return;
          }
        }
      }
      const hit = [...elementsRef.current].reverse().find((e) => hitTest(e, x, y, 8 / zoom));
      if (hit) {
        let nextIds;
        if (shiftKey) {
          nextIds = ids.includes(hit.id) ? ids.filter((i) => i !== hit.id) : [...ids, hit.id];
        } else {
          nextIds = ids.includes(hit.id) ? ids : [hit.id];
        }
        setSelectedIdsState(nextIds);
        selectedIdsRef.current = nextIds;
        interaction.current = {
          type: 'move',
          startX: x,
          startY: y,
          moved: false,
          originals: elementsRef.current.filter((e) => nextIds.includes(e.id)).map((e) => ({ ...e })),
        };
      } else {
        if (!shiftKey) {
          setSelectedIdsState([]);
          selectedIdsRef.current = [];
        }
        interaction.current = {
          type: 'select',
          startX: x,
          startY: y,
          additive: shiftKey,
          prevIds: shiftKey ? [...selectedIdsRef.current] : [],
        };
      }
      return;
    }

    if (SHAPE_TOOLS.includes(tool)) {
      const el = createElement(tool, x, y, currentStyleRef.current);
      if (tool === TOOL.DRAW) el.points = [[0, 0]];
      else if (tool === TOOL.LINE || tool === TOOL.ARROW) el.points = [[0, 0], [0, 0]];
      const next = [...elementsRef.current, el];
      updateElements(next, false);
      interaction.current = { type: 'draw', draftId: el.id, startX: x, startY: y, moved: false };
    }
  }, [getScenePoint, updateElements, createTextAt, eraseAt]);

  const moveInteraction = useCallback((clientX, clientY) => {
    const [x, y] = getScenePoint(clientX, clientY);
    const act = interaction.current;

    if (collabRef.current.roomId) collabRef.current.broadcastPointer(x, y);

    switch (act.type) {
      case 'pan':
        setAppStateState((prev) => ({
          ...prev,
          scrollX: act.startScrollX + (clientX - act.startClientX),
          scrollY: act.startScrollY + (clientY - act.startClientY),
        }));
        break;
      case 'draw': {
        const next = elementsRef.current.map((e) => {
          if (e.id !== act.draftId) return e;
          if (e.type === TOOL.DRAW) return { ...e, points: [...e.points, [x - e.x, y - e.y]] };
          if (e.type === TOOL.LINE || e.type === TOOL.ARROW) {
            return { ...e, points: [[0, 0], [x - e.x, y - e.y]] };
          }
          return { ...e, width: x - e.x, height: y - e.y };
        });
        act.moved = true;
        updateElements(next);
        break;
      }
      case 'move': {
        const dx = x - act.startX;
        const dy = y - act.startY;
        if (dx !== 0 || dy !== 0) act.moved = true;
        const originals = new Map(act.originals.map((o) => [o.id, o]));
        const next = elementsRef.current.map((e) => {
          const o = originals.get(e.id);
          return o ? { ...e, x: o.x + dx, y: o.y + dy } : e;
        });
        updateElements(next);
        break;
      }
      case 'resize': {
        act.moved = true;
        const next = elementsRef.current.map((e) =>
          (e.id === act.original.id ? resizeElement(act.original, act.handle, x, y) : e));
        updateElements(next);
        break;
      }
      case 'rotate': {
        act.moved = true;
        const next = elementsRef.current.map((e) =>
          (e.id === act.original.id ? rotateElement(act.original, x, y) : e));
        updateElements(next);
        break;
      }
      case 'bend': {
        act.moved = true;
        const next = elementsRef.current.map((e) =>
          (e.id === act.original.id ? setBend(act.original, x, y) : e));
        updateElements(next);
        break;
      }
      case 'select': {
        const box = { x1: act.startX, y1: act.startY, x2: x, y2: y };
        setSelectionBox(box);
        const norm = {
          x1: Math.min(box.x1, box.x2),
          y1: Math.min(box.y1, box.y2),
          x2: Math.max(box.x1, box.x2),
          y2: Math.max(box.y1, box.y2),
        };
        const inside = elementsRef.current.filter((e) => isElementInBox(e, norm)).map((e) => e.id);
        const merged = act.additive ? Array.from(new Set([...act.prevIds, ...inside])) : inside;
        setSelectedIdsState(merged);
        selectedIdsRef.current = merged;
        break;
      }
      case 'erase':
        eraseAt(x, y);
        break;
      default:
        break;
    }
  }, [getScenePoint, updateElements, eraseAt]);

  const endInteraction = useCallback(() => {
    const act = interaction.current;
    interaction.current = { type: 'none' };

    if (act.type === 'draw') {
      let next = elementsRef.current;
      const el = next.find((e) => e.id === act.draftId);
      if (el) {
        if (!act.moved && el.type !== TOOL.DRAW) {
          if (el.type === TOOL.LINE || el.type === TOOL.ARROW) {
            next = next.filter((e) => e.id !== act.draftId);
          } else {
            next = next.map((e) => (e.id === act.draftId ? { ...e, width: 100, height: 100 } : e));
          }
        }
        next = next.map((e) => (e.id === act.draftId ? normalizeElement(e) : e));
        commitElements(next);
        if (next.some((e) => e.id === act.draftId)) {
          setSelectedIdsState([act.draftId]);
          selectedIdsRef.current = [act.draftId];
        }
      }
      if (!toolLockedRef.current) setActiveToolState(TOOL.SELECTION);
    } else if (act.type === 'move' || act.type === 'resize' || act.type === 'rotate' || act.type === 'bend') {
      if (act.moved) {
        history.record(elementsRef.current);
        setDirty(true);
      }
    } else if (act.type === 'select') {
      setSelectionBox(null);
    } else if (act.type === 'erase') {
      if (act.erased) {
        history.record(elementsRef.current);
        setDirty(true);
      }
    }
  }, [commitElements, history]);

  const handlePointerDown = useCallback((e) => {
    if (e.button === 2) return;
    if (editingIdRef.current) commitText();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    beginInteraction(e.clientX, e.clientY, e.shiftKey, e.button);
    const t = interaction.current.type;
    if (t === 'pan' || t === 'move' || t === 'resize' || t === 'rotate' || t === 'bend') {
      setCursor('grabbing');
    }
  }, [beginInteraction, commitText, setCursor]);

  useEffect(() => {
    const onMove = (e) => {
      if (interaction.current.type !== 'none') moveInteraction(e.clientX, e.clientY);
    };
    const onUp = () => {
      if (interaction.current.type !== 'none') {
        endInteraction();
        setCursor(null);
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [moveInteraction, endInteraction, setCursor]);

  const handleDoubleClick = useCallback((e) => {
    const [x, y] = getScenePoint(e.clientX, e.clientY);
    const { zoom } = appStateRef.current;
    const hit = [...elementsRef.current].reverse().find((el) => hitTest(el, x, y, 8 / zoom));
    if (hit && hit.type === TOOL.TEXT) {
      setSelectedIdsState([hit.id]);
      selectedIdsRef.current = [hit.id];
      setEditingId(hit.id);
    } else if (activeToolRef.current === TOOL.SELECTION) {
      createTextAt(x, y);
    }
  }, [getScenePoint, createTextAt]);

  // -- Image insertion -----------------------------------------------------
  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const maxW = 420;
        const scale = Math.min(1, maxW / img.width);
        const w = img.width * scale;
        const h = img.height * scale;
        const [px, py] = pendingImagePoint.current
          || getScenePoint(window.innerWidth / 2, window.innerHeight / 2);
        const el = createElement(TOOL.IMAGE, px - w / 2, py - h / 2, currentStyleRef.current);
        el.src = ev.target.result;
        el.width = w;
        el.height = h;
        commitElements([...elementsRef.current, el]);
        setSelectedIdsState([el.id]);
        selectedIdsRef.current = [el.id];
        if (!toolLockedRef.current) setActiveToolState(TOOL.SELECTION);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }, [commitElements, getScenePoint]);

  // -- Rendering -----------------------------------------------------------
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const dpr = window.devicePixelRatio || 1;
    const { width, height } = container.getBoundingClientRect();
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    scheduleRender();
  }, [scheduleRender]);

  useEffect(() => {
    resizeCanvas();
    const observer = new ResizeObserver(resizeCanvas);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [resizeCanvas]);

  useEffect(() => {
    if (!canvasRef.current) return;
    renderScene(canvasRef.current, {
      elements,
      appState,
      selectedIds,
      editingId,
      selectionBox,
      eraserIds: activeTool === TOOL.ERASER ? eraserHover : [],
      requestRender: scheduleRender,
    });
  }, [elements, appState, selectedIds, editingId, selectionBox, eraserHover, activeTool, tick, scheduleRender]);

  // -- Zoom / pan ----------------------------------------------------------
  const zoomTo = useCallback((target, centerX, centerY) => {
    setAppStateState((prev) => {
      const rect = containerRef.current.getBoundingClientRect();
      const px = centerX ?? rect.width / 2;
      const py = centerY ?? rect.height / 2;
      const newZoom = clamp(target, ZOOM_MIN, ZOOM_MAX);
      const wx = (px - prev.scrollX) / prev.zoom;
      const wy = (py - prev.scrollY) / prev.zoom;
      return { ...prev, zoom: newZoom, scrollX: px - wx * newZoom, scrollY: py - wy * newZoom };
    });
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const factor = Math.exp(-e.deltaY * 0.001);
        const rect = container.getBoundingClientRect();
        zoomTo(appStateRef.current.zoom * factor, e.clientX - rect.left, e.clientY - rect.top);
      } else {
        setAppStateState((prev) => ({
          ...prev,
          scrollX: prev.scrollX - e.deltaX,
          scrollY: prev.scrollY - e.deltaY,
        }));
      }
    };
    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [zoomTo]);

  // -- Style / layers / actions -------------------------------------------
  const applyStyle = useCallback((patch) => {
    setCurrentStyle((s) => ({ ...s, ...patch }));
    if (selectedIdsRef.current.length) {
      const next = elementsRef.current.map((e) => {
        if (!selectedIdsRef.current.includes(e.id)) return e;
        const updated = { ...e, ...patch };
        if (e.type === TOOL.TEXT && (patch.fontSize || patch.fontFamily)) {
          const { width, height } = measureText(e.text || ' ', updated.fontSize, updated.fontFamily);
          updated.width = width;
          updated.height = height;
        }
        return updated;
      });
      commitElements(next);
    }
  }, [commitElements]);

  const deleteSelected = useCallback(() => {
    if (!selectedIdsRef.current.length) return;
    const next = elementsRef.current.filter((e) => !selectedIdsRef.current.includes(e.id));
    setSelectedIdsState([]);
    selectedIdsRef.current = [];
    commitElements(next);
  }, [commitElements]);

  const duplicateSelected = useCallback(() => {
    const sel = elementsRef.current.filter((e) => selectedIdsRef.current.includes(e.id));
    if (!sel.length) return;
    const dupes = sel.map((e) => duplicateElement(e));
    commitElements([...elementsRef.current, ...dupes]);
    const ids = dupes.map((d) => d.id);
    setSelectedIdsState(ids);
    selectedIdsRef.current = ids;
  }, [commitElements]);

  const copySelected = useCallback(async () => {
    const sel = elementsRef.current.filter((e) => selectedIdsRef.current.includes(e.id));
    if (!sel.length) return;
    clipboardRef.current = sel.map((e) => ({ ...e }));
    try {
      await navigator.clipboard.writeText(JSON.stringify({ type: 'whiteboard/elements', elements: sel }));
    } catch { /* clipboard blocked */ }
  }, []);

  const pasteElements = useCallback((els) => {
    if (!els || !els.length) return;
    const dupes = els.map((el) => duplicateElement(el, 24, 24));
    commitElements([...elementsRef.current, ...dupes]);
    const ids = dupes.map((d) => d.id);
    setSelectedIdsState(ids);
    selectedIdsRef.current = ids;
  }, [commitElements]);

  const insertMermaid = useCallback(async (code) => {
    if (!code || !code.trim()) return;
    try {
      const dataUrl = await renderMermaidToDataUrl(code);
      await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const natW = img.naturalWidth || 400;
          const natH = img.naturalHeight || 300;
          const scale = Math.min(1, 520 / natW);
          const w = natW * scale;
          const h = natH * scale;
          const rect = containerRef.current.getBoundingClientRect();
          const [px, py] = getScenePoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
          const el = createElement(TOOL.IMAGE, px - w / 2, py - h / 2, currentStyleRef.current);
          el.src = dataUrl;
          el.width = w;
          el.height = h;
          commitElements([...elementsRef.current, el]);
          setSelectedIdsState([el.id]);
          selectedIdsRef.current = [el.id];
          resolve();
        };
        img.onerror = reject;
        img.src = dataUrl;
      });
    } catch (err) {
      console.error('Mermaid render failed:', err);
      setNotice('Could not render that Mermaid diagram. Check the syntax.');
    }
  }, [commitElements, getScenePoint]);

  const reorderSelected = useCallback((action) => {
    const ids = selectedIdsRef.current;
    if (!ids.length) return;
    let arr = [...elementsRef.current];
    const sel = arr.filter((e) => ids.includes(e.id));
    const rest = arr.filter((e) => !ids.includes(e.id));
    if (action === 'front') arr = [...rest, ...sel];
    else if (action === 'back') arr = [...sel, ...rest];
    else if (action === 'forward') {
      for (let i = arr.length - 2; i >= 0; i -= 1) {
        if (ids.includes(arr[i].id) && !ids.includes(arr[i + 1].id)) {
          [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
        }
      }
    } else if (action === 'backward') {
      for (let i = 1; i < arr.length; i += 1) {
        if (ids.includes(arr[i].id) && !ids.includes(arr[i - 1].id)) {
          [arr[i], arr[i - 1]] = [arr[i - 1], arr[i]];
        }
      }
    }
    commitElements(arr);
  }, [commitElements]);

  const selectAll = useCallback(() => {
    const ids = elementsRef.current.map((e) => e.id);
    setSelectedIdsState(ids);
    selectedIdsRef.current = ids;
    setActiveToolState(TOOL.SELECTION);
  }, []);

  // -- Undo / redo ---------------------------------------------------------
  const doUndo = useCallback(() => {
    const snapshot = history.undo();
    if (snapshot) {
      updateElements(snapshot);
      setDirty(true);
    }
  }, [history, updateElements]);

  const doRedo = useCallback(() => {
    const snapshot = history.redo();
    if (snapshot) {
      updateElements(snapshot);
      setDirty(true);
    }
  }, [history, updateElements]);

  // -- Keyboard ------------------------------------------------------------
  useEffect(() => {
    const onKeyDown = (e) => {
      const target = e.target;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');

      if (e.key === ' ' && !typing) spaceDownRef.current = true;
      if (typing) {
        if (e.key === 'Escape') target.blur();
        return;
      }

      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) doRedo(); else doUndo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); doRedo(); return; }
      if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); selectAll(); return; }
      if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateSelected(); return; }
      if (mod && e.key.toLowerCase() === 'c') { copySelected(); return; }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelected();
        return;
      }
      if (e.key === 'Escape') {
        setSelectedIdsState([]);
        selectedIdsRef.current = [];
        return;
      }
      const tool = TOOL_SHORTCUTS[e.key.toLowerCase()];
      if (tool && !mod) setActiveTool(tool);
    };
    const onKeyUp = (e) => {
      if (e.key === ' ') spaceDownRef.current = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [doUndo, doRedo, selectAll, duplicateSelected, copySelected, deleteSelected, setActiveTool]);

  // Paste: Mermaid code -> diagram, whiteboard JSON -> elements, else internal clipboard.
  useEffect(() => {
    const onPaste = (e) => {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      const text = (e.clipboardData && e.clipboardData.getData('text/plain')) || '';
      const trimmed = text.trim();
      if (trimmed && isMermaid(trimmed)) {
        e.preventDefault();
        insertMermaid(trimmed);
        return;
      }
      if (trimmed) {
        try {
          const data = JSON.parse(trimmed);
          if (data && data.type === 'whiteboard/elements' && Array.isArray(data.elements)) {
            e.preventDefault();
            pasteElements(data.elements);
            return;
          }
        } catch { /* not JSON */ }
      }
      if (clipboardRef.current.length) {
        e.preventDefault();
        pasteElements(clipboardRef.current);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [insertMermaid, pasteElements]);

  // Auto-dismiss transient notices.
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  // -- Reflect selection into the style panel ------------------------------
  useEffect(() => {
    if (!selectedIds.length) return;
    const el = elements.find((e) => e.id === selectedIds[selectedIds.length - 1]);
    if (!el) return;
    setCurrentStyle((s) => ({
      ...s,
      strokeColor: el.strokeColor,
      backgroundColor: el.backgroundColor,
      fillStyle: el.fillStyle,
      strokeWidth: el.strokeWidth,
      strokeStyle: el.strokeStyle,
      roughness: el.roughness,
      edges: el.edges,
      opacity: el.opacity,
      fontSize: el.fontSize ?? s.fontSize,
      fontFamily: el.fontFamily ?? s.fontFamily,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds]);

  // -- Persistence ---------------------------------------------------------
  const loadScene = useCallback((data) => {
    const els = Array.isArray(data.elements) ? data.elements : [];
    elementsRef.current = els;
    setElementsState(els);
    setAppStateState((prev) => ({ ...prev, ...(data.appState || {}) }));
    history.reset(els);
    setSelectedIdsState([]);
    setCurrentRoomId(data.roomId || null);
    setWorkspaceName(data.name || 'Untitled workspace');
    setDirty(false);
  }, [history]);

  const handleJsonFile = useCallback((e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        const els = Array.isArray(data.elements)
          ? data.elements
          : (Array.isArray(data) ? data : null);
        if (!els) throw new Error('No elements');
        loadScene({ elements: els, appState: data.appState || {}, name: data.name });
      } catch (err) {
        console.error('Import failed:', err);
        setNotice('That file is not a valid whiteboard export.');
      }
    };
    reader.readAsText(file);
  }, [loadScene]);

  const saveWorkspace = useCallback(async () => {
    setSaving(true);
    try {
      if (!currentRoomIdRef.current) {
        const room = await api.createRoom({
          name: workspaceName,
          elements: elementsRef.current,
          appState: appStateRef.current,
        });
        setCurrentRoomId(room.roomId);
      } else {
        await api.saveScene(currentRoomIdRef.current, {
          name: workspaceName,
          elements: elementsRef.current,
          appState: appStateRef.current,
        });
      }
      setDirty(false);
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  }, [workspaceName]);

  // Debounced autosave for existing workspaces.
  useEffect(() => {
    if (!currentRoomId || !dirty) return undefined;
    const t = setTimeout(() => {
      api.saveScene(currentRoomId, {
        name: workspaceName,
        elements: elementsRef.current,
        appState: appStateRef.current,
      }).then(() => setDirty(false)).catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, [elements, appState, dirty, currentRoomId, workspaceName]);

  const openWorkspaces = useCallback(async () => {
    setWorkspacesOpen(true);
    setRoomsLoading(true);
    try {
      setRooms(await api.listRooms());
    } catch (err) {
      console.error('List rooms failed:', err);
    } finally {
      setRoomsLoading(false);
    }
  }, []);

  const openRoom = useCallback(async (roomId) => {
    try {
      const room = await api.getRoom(roomId);
      loadScene(room);
      setWorkspacesOpen(false);
    } catch (err) {
      console.error('Open room failed:', err);
    }
  }, [loadScene]);

  const deleteRoom = useCallback(async (roomId) => {
    try {
      await api.deleteRoom(roomId);
      setRooms((prev) => prev.filter((r) => r.roomId !== roomId));
      if (currentRoomIdRef.current === roomId) setCurrentRoomId(null);
    } catch (err) {
      console.error('Delete room failed:', err);
    }
  }, []);

  const newWorkspace = useCallback(() => {
    elementsRef.current = [];
    setElementsState([]);
    setAppStateState(DEFAULT_APP_STATE);
    history.reset([]);
    setSelectedIdsState([]);
    setCurrentRoomId(null);
    setWorkspaceName('Untitled workspace');
    setWorkspacesOpen(false);
    setDirty(false);
    window.history.replaceState(null, '', '/whiteboard');
  }, [history]);

  const clearCanvas = useCallback(() => {
    setSelectedIdsState([]);
    selectedIdsRef.current = [];
    commitElements([]);
  }, [commitElements]);

  // -- Export --------------------------------------------------------------
  const exportImage = useCallback(() => {
    const els = elementsRef.current;
    if (!els.length) return;
    const b = getBoundingBox(els);
    const pad = 24;
    const scale = 2;
    const w = b.x2 - b.x1 + pad * 2;
    const h = b.y2 - b.y1 + pad * 2;
    const tmp = document.createElement('canvas');
    tmp.width = Math.max(1, Math.floor(w * scale));
    tmp.height = Math.max(1, Math.floor(h * scale));
    renderScene(tmp, {
      elements: els,
      appState: {
        viewBackgroundColor: appStateRef.current.viewBackgroundColor,
        scrollX: -b.x1 + pad,
        scrollY: -b.y1 + pad,
        zoom: 1,
        gridSize: 0,
      },
      pixelRatio: scale,
    });
    const link = document.createElement('a');
    link.download = `${workspaceName || 'whiteboard'}.png`;
    link.href = tmp.toDataURL('image/png');
    link.click();
  }, [workspaceName]);

  const exportFile = useCallback(() => {
    const data = JSON.stringify({
      type: 'whiteboard',
      version: 1,
      elements: elementsRef.current,
      appState: appStateRef.current,
    }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const link = document.createElement('a');
    link.download = `${workspaceName || 'whiteboard'}.json`;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  }, [workspaceName]);

  // -- Collaboration controls ---------------------------------------------
  const shareLink = useMemo(
    () => (currentRoomId ? `${window.location.origin}/whiteboard?room=${currentRoomId}` : ''),
    [currentRoomId],
  );

  const startCollab = useCallback(async () => {
    let id = currentRoomIdRef.current;
    try {
      if (!id) {
        const room = await api.createRoom({
          name: workspaceName,
          elements: elementsRef.current,
          appState: appStateRef.current,
        });
        id = room.roomId;
        setCurrentRoomId(id);
      } else {
        await api.saveScene(id, {
          name: workspaceName,
          elements: elementsRef.current,
          appState: appStateRef.current,
        });
      }
      collabRef.current.join(id);
      window.history.replaceState(null, '', `/whiteboard?room=${id}`);
    } catch (err) {
      console.error('Start collaboration failed:', err);
    }
  }, [workspaceName]);

  const stopCollab = useCallback(() => {
    if (micOn) {
      collabRef.current.sendVoiceMicState(false);
      destroyAllPeers();
      stopLocalAudio();
      setMicOn(false);
    }
    if (collabRef.current.isHost) collabRef.current.endSession();
    else collabRef.current.leave();
    setRemotePointers({});
    setPendingRequests([]);
    setChatMessages([]);
    setChatOpen(false);
    setUnreadMessages(0);
    window.history.replaceState(null, '', '/whiteboard');
  }, [micOn, destroyAllPeers, stopLocalAudio]);

  const respondJoin = useCallback((socketId, approved) => {
    collabRef.current.respondJoin(socketId, approved);
    setPendingRequests((prev) => prev.filter((r) => r.socketId !== socketId));
  }, []);

  const joinCollab = useCallback((roomId) => {
    collabRef.current.join(roomId);
    setCurrentRoomId(roomId);
    setShareOpen(false);
    window.history.replaceState(null, '', `/whiteboard?room=${roomId}`);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    if (room) {
      collabRef.current.join(room);
      setCurrentRoomId(room);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSignOut = useCallback(() => {
    if (micOn) {
      collabRef.current.sendVoiceMicState(false);
      destroyAllPeers();
      stopLocalAudio();
      setMicOn(false);
    }
    collabRef.current.leave();
    logout();
    navigate('/login');
  }, [logout, navigate, micOn, destroyAllPeers, stopLocalAudio]);

  // -- Derived UI state ----------------------------------------------------
  const editingElement = editingId ? elements.find((e) => e.id === editingId) : null;
  const panelVisible = selectedIds.length > 0 || SHAPE_TOOLS.includes(activeTool) || activeTool === TOOL.TEXT;
  const showTextControls = activeTool === TOOL.TEXT
    || elements.some((e) => selectedIds.includes(e.id) && e.type === TOOL.TEXT);

  const cursorList = useMemo(() => {
    const { zoom, scrollX, scrollY } = appState;
    return Object.entries(remotePointers).map(([socketId, p]) => ({
      socketId,
      username: p.username,
      color: p.color,
      x: p.sceneX * zoom + scrollX,
      y: p.sceneY * zoom + scrollY,
    }));
  }, [remotePointers, appState]);

  const canvasCursor = activeTool === TOOL.HAND
    ? 'grab'
    : activeTool === TOOL.SELECTION
      ? 'default'
      : activeTool === TOOL.TEXT
        ? 'text'
        : 'crosshair';
  const cursorStyle = dynamicCursor || canvasCursor;

  return (
    <div ref={containerRef} className="relative h-screen w-screen overflow-hidden bg-white">
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handleHover}
        onDoubleClick={handleDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
        className="absolute inset-0"
        style={{ touchAction: 'none', cursor: cursorStyle }}
      />

      <CollabCursors pointers={cursorList} />

      {editingElement && (
        <textarea
          ref={textareaRef}
          autoFocus
          value={editingElement.text}
          onChange={(e) => handleTextChange(e.target.value)}
          onBlur={commitText}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { e.preventDefault(); e.currentTarget.blur(); }
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitText(); }
          }}
          className="absolute z-40 resize-none overflow-hidden border-none bg-transparent p-0 leading-tight outline-none"
          style={{
            left: editingElement.x * appState.zoom + appState.scrollX,
            top: editingElement.y * appState.zoom + appState.scrollY,
            width: Math.max(20, editingElement.width) * appState.zoom + 4,
            height: Math.max(editingElement.fontSize, editingElement.height) * appState.zoom + 4,
            fontSize: editingElement.fontSize * appState.zoom,
            fontFamily: FONT_FAMILIES[editingElement.fontFamily] || FONT_FAMILIES.hand,
            color: editingElement.strokeColor,
            lineHeight: 1.25,
          }}
        />
      )}

      <div className="absolute left-3 top-3 z-20 sm:left-4 sm:top-4">
        <MainMenu
          user={user}
          saving={saving}
          onSave={saveWorkspace}
          onOpen={openWorkspaces}
          onExportImage={exportImage}
          onExportFile={exportFile}
          onImportFile={() => jsonInputRef.current?.click()}
          onInsertMermaid={() => setMermaidOpen(true)}
          onClear={clearCanvas}
          gridEnabled={appState.gridSize > 0}
          onToggleGrid={() => setAppStateState((prev) => ({ ...prev, gridSize: prev.gridSize > 0 ? 0 : 20 }))}
          canvasBackground={appState.viewBackgroundColor}
          onCanvasBackground={(c) => { setAppStateState((prev) => ({ ...prev, viewBackgroundColor: c })); setDirty(true); }}
          onSignOut={handleSignOut}
        />
      </div>

      <div className="absolute left-1/2 top-16 z-20 -translate-x-1/2 sm:top-4">
        <TopToolbar
          activeTool={activeTool}
          onToolChange={setActiveTool}
          locked={toolLocked}
          onToggleLock={() => {
            setToolLocked((v) => {
              const next = !v;
              toolLockedRef.current = next;
              return next;
            });
          }}
        />
        <div className="mt-2 hidden text-center text-[13px] text-gray-400 sm:block">
          {SHAPE_TOOLS.includes(activeTool) || activeTool === TOOL.TEXT
            ? 'Click and drag to draw · Enter to add text'
            : 'To move the canvas, hold Space or use the hand tool'}
        </div>
      </div>

      <div className="absolute right-3 top-3 z-20 flex items-center gap-2 sm:right-4 sm:top-4">
        <Collaborators collaborators={collab.collaborators} mySocketId={collab.mySocketId} />
        {collab.roomId && (
          <button
            type="button"
            title="Chat"
            onClick={() => {
              setChatOpen((v) => {
                const next = !v;
                if (next) setUnreadMessages(0);
                return next;
              });
            }}
            className={`relative flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 shadow-md hover:bg-gray-100 ${
              chatOpen ? 'bg-gray-900 text-white' : 'bg-white text-gray-700'
            }`}
          >
            <MessageSquare size={18} />
            {unreadMessages > 0 && (
              <span className="absolute -right-1 -top-1 min-w-[1.1rem] rounded-full bg-red-600 px-1 text-center text-[10px] font-semibold leading-4 text-white">
                +{unreadMessages}
              </span>
            )}
          </button>
        )}
        {collab.roomId && (
          <button
            type="button"
            title={micOn ? 'Mute microphone' : 'Enable microphone'}
            onClick={toggleMic}
            className={`flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 shadow-md hover:bg-gray-100 ${
              micOn ? 'bg-gray-900 text-white' : 'bg-white text-gray-700'
            }`}
          >
            {micOn ? <Mic size={18} /> : <MicOff size={18} />}
          </button>
        )}
        <button
          type="button"
          onClick={() => setShareOpen(true)}
          className="flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white shadow-md hover:bg-black"
        >
          <Share2 size={16} /> <span className="hidden sm:inline">Share</span>
        </button>
      </div>

      {panelVisible && (
        <div className="absolute left-3 top-28 z-10 sm:top-20">
          <PropertiesPanel
            style={currentStyle}
            onChange={applyStyle}
            showText={showTextControls}
            hasSelection={selectedIds.length > 0}
            onLayer={reorderSelected}
            onDuplicate={duplicateSelected}
            onDelete={deleteSelected}
            onCopy={copySelected}
          />
        </div>
      )}

      <div className="absolute bottom-4 left-4 z-20">
        <ZoomControls
          zoom={appState.zoom}
          onZoomIn={() => zoomTo(Math.round((appState.zoom + 0.1) * 10) / 10)}
          onZoomOut={() => zoomTo(Math.round((appState.zoom - 0.1) * 10) / 10)}
          onZoomReset={() => zoomTo(1)}
          onUndo={doUndo}
          onRedo={doRedo}
          canUndo={history.canUndo}
          canRedo={history.canRedo}
        />
      </div>

      {chatOpen && collab.roomId && (
        <div className="absolute bottom-4 right-3 z-30 sm:right-4">
          <ChatPanel
            open={chatOpen}
            onClose={() => setChatOpen(false)}
            messages={chatMessages}
            onSend={(text) => collab.sendChat(text)}
            mySocketId={collab.mySocketId}
          />
        </div>
      )}

      {pendingRequests.length > 0 && (
        <div className="absolute right-3 top-28 z-30 sm:right-4 sm:top-20">
          <JoinRequests requests={pendingRequests} onRespond={respondJoin} />
        </div>
      )}

      {notice && (
        <div className="absolute left-1/2 top-3 z-50 max-w-[90vw] -translate-x-1/2 rounded-lg bg-gray-900/90 px-4 py-2 text-center text-sm text-white shadow-lg">
          {notice}
        </div>
      )}

      {collab.awaiting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xs rounded-2xl bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
            <p className="text-sm font-medium text-gray-800">Waiting for the host to let you in…</p>
            <button
              type="button"
              onClick={() => {
                collab.leave();
                setCurrentRoomId(null);
                window.history.replaceState(null, '', '/whiteboard');
              }}
              className="mt-4 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      <input ref={jsonInputRef} type="file" accept="application/json,.json" className="hidden" onChange={handleJsonFile} />

      <ShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        roomId={collab.roomId}
        isHost={collab.isHost}
        shareLink={shareLink}
        collaboratorsCount={collab.collaborators.length}
        onStart={startCollab}
        onStop={stopCollab}
        onJoin={joinCollab}
      />

      <WorkspacesDialog
        open={workspacesOpen}
        onClose={() => setWorkspacesOpen(false)}
        rooms={rooms}
        loading={roomsLoading}
        currentRoomId={currentRoomId}
        onOpen={openRoom}
        onDelete={deleteRoom}
        onNew={newWorkspace}
      />

      <MermaidDialog
        open={mermaidOpen}
        onClose={() => setMermaidOpen(false)}
        onInsert={insertMermaid}
      />
    </div>
  );
}
