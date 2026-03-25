module.exports = function setupSocketHandlers(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.cookie
      ?.split(';').find(c => c.trim().startsWith('token='))?.split('=')[1];

    if (!token) {
      // Allow unauthenticated connections for gallery viewing
      socket.userId = null;
      return next();
    }

    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'chitrakavyam_secret');
      socket.userId = decoded.userId;
      socket.userEmail = decoded.email;
      socket.isAdmin = decoded.isAdmin;
    } catch (err) {
      socket.userId = null;
    }
    next();
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}, user: ${socket.userId || 'anonymous'}`);

    if (socket.userId) {
      socket.join(`user:${socket.userId}`);
    }

    socket.on('subscribe:artwork', ({ artworkId }) => {
      socket.join(`artwork:${artworkId}`);
    });

    socket.on('unsubscribe:artwork', ({ artworkId }) => {
      socket.leave(`artwork:${artworkId}`);
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
};
