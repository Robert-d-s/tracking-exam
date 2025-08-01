import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { User } from '../user.model';
import { UserTeamService } from '../services/user-team.service';
import { Roles } from '../../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { UserTeamInput } from '../user.input';

@Resolver(() => User)
export class UserTeamManagementResolver {
  constructor(
    @InjectPinoLogger(UserTeamManagementResolver.name)
    private readonly logger: PinoLogger,
    private userTeamService: UserTeamService,
  ) {}

  @Mutation(() => User)
  @Roles(UserRole.ADMIN)
  async addUserToTeam(@Args('input') input: UserTeamInput): Promise<User> {
    this.logger.info({ input }, 'Executing addUserToTeam mutation');
    // Let custom exceptions bubble up with proper error codes
    const user = await this.userTeamService.addUserToTeam(
      input.userId,
      input.teamId,
    );
    return {
      id: user.id,
      email: user.email,
      role: user.role,
    };
  }

  @Mutation(() => User)
  @Roles(UserRole.ADMIN)
  async removeUserFromTeam(@Args('input') input: UserTeamInput): Promise<User> {
    this.logger.info({ input }, 'Executing removeUserFromTeam mutation');
    // No try-catch needed - let the custom exceptions bubble up
    // They provide proper HTTP status codes and error messages
    const user = await this.userTeamService.removeUserFromTeam(
      input.userId,
      input.teamId,
    );
    return {
      id: user.id,
      email: user.email,
      role: user.role,
    };
  }
}
