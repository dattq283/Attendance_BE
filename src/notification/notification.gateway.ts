import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

interface JwtPayload {
  sub: number;
  email: string;
  role: string;
}

@WebSocketGateway({ cors: { origin: '*' } })
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  constructor(private jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.query.token as string;
      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify<JwtPayload>(token);
      const userId = payload.sub;

      await client.join(`user_${userId}`);
      console.log(`User ${userId} joined room via JWT authentication`);
    } catch {
      console.log('Invalid JWT, disconnecting client');
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    console.log('User disconnected:', client.id);
  }

  notifyUser(userId: number, event: string, payload: unknown) {
    this.server.to(`user_${userId}`).emit(event, payload);
  }
}
