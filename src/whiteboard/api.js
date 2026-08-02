import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// The auth token is attached globally by AuthContext via axios defaults.
const rooms = `${API_URL}/api/rooms`;

export async function listRooms() {
  const { data } = await axios.get(rooms);
  return data;
}

export async function createRoom({ name, roomId, elements, appState } = {}) {
  const { data } = await axios.post(rooms, { name, roomId, elements, appState });
  return data;
}

export async function getRoom(roomId) {
  const { data } = await axios.get(`${rooms}/${roomId}`);
  return data;
}

export async function saveScene(roomId, { elements, appState, name }) {
  const { data } = await axios.put(`${rooms}/${roomId}/scene`, { elements, appState, name });
  return data;
}

export async function deleteRoom(roomId) {
  const { data } = await axios.delete(`${rooms}/${roomId}`);
  return data;
}
