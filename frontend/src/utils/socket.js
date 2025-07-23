// socket.js
import { io } from "socket.io-client";
const socket = io('http://localhost:3001', { withCredentials: true }); // adapte l'URL si besoin
export default socket;
