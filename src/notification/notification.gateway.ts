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
      const token = this.extractToken(client);
      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify<JwtPayload>(token);
      const userId = payload.sub;
      const userRole = payload.role;
      await client.join(`user_${userId}`);
      await client.join(`role_${userRole}`);
      console.log(
        `${userRole} with id ${userId} joined room via JWT authentication`,
      );
    } catch {
      console.log('Invalid JWT, disconnecting client');
      client.disconnect();
    }
  }

  private extractToken(client: Socket): string | undefined {
    if (client.handshake.auth?.token) {
      return client.handshake.auth.token as string;
    }
    const authHeader = client.handshake.headers?.authorization;
    if (authHeader?.startsWith('Bearer ')) return authHeader.substring(7);
    if (client.handshake.query?.token) {
      return client.handshake.query.token as string;
    }
    return undefined;
  }

  handleDisconnect(client: Socket) {
    console.log('User disconnected:', client.id);
  }

  notifyUser(userId: number, event: string, payload: unknown) {
    this.server.to(`user_${userId}`).emit(event, payload);
  }

  notifyAdmin(event: string, payload: unknown) {
    this.server.to('role_ADMIN').emit(event, payload);
  }
}
