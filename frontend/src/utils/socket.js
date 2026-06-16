// socket.js
import { io } from "socket.io-client";
import { API_BASE } from './apiBase';

const socket = io(API_BASE, { withCredentials: true });
export default socket;
