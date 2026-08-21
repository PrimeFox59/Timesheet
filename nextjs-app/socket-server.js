const { Server } = require('socket.io');
const http = require('http');

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/broadcast') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const { event, data } = payload;
        if (event && io) {
          io.emit(event, data);
          console.log(`[Socket RTC] Broadcasted event '${event}' to ${io.engine.clientsCount} clients.`);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Socket.io Realtime RTC Server Running');
  }
});

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  console.log(`[Socket RTC] Client connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`[Socket RTC] Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.SOCKET_PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Realtime Socket.io RTC Server listening on port ${PORT}`);
});
