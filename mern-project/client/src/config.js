// REACT_APP_API_URL:
//   local (docker-compose) → http://localhost:5050
//   kubernetes             → "" (empty = relative, nginx proxies to server service)
const API_BASE = process.env.REACT_APP_API_URL || "";

export default API_BASE;
