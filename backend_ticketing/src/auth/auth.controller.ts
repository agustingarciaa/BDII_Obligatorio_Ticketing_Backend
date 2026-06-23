import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, RegisterFuncionarioDto } from './auth.dto';
import { Public, Roles, CurrentUser } from './decorators';
import type { AuthUser } from './decorators';
import { Role } from './roles.enum';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('logout')
  logout() {
    return this.authService.logout();
  }

  @Roles(Role.ADMIN)
  @Post('register/funcionario')
  registerFuncionario(
    @Body() dto: RegisterFuncionarioDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.authService.registerFuncionario(dto, user);
  }
}
