import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto, LoginDto } from './auth.dto';
import { Role } from './roles.enum';

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  async register(_dto: RegisterDto) {
  
  }

  login(_dto: LoginDto) {
  
    throw new UnauthorizedException('Implementación pendiente');
  }

  logout() {
  }

  generateToken(userId: number, role: Role) {
    return {
      access_token: this.jwtService.sign({ sub: userId, role }),
    };
  }
}
